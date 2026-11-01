import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { AppError, type Config } from './config.js';

export interface AiResponse { text: string; inputTokens?: number; outputTokens?: number }
export interface AiTransport {
  call(model: string, prompt: string, schema: Record<string, unknown>, signal: AbortSignal): Promise<AiResponse>;
}

export class GeminiTransport implements AiTransport {
  private client: GoogleGenAI;
  constructor(private config: Config) {
    this.client = new GoogleGenAI({apiKey: config.GEMINI_API_KEY});
  }
  async call(model: string, prompt: string, schema: Record<string, unknown>, signal: AbortSignal) {
    const result = await this.client.interactions.create({
      model, input: prompt, store:false,
      response_format: {type:'text', mime_type:'application/json', schema},
      generation_config: {max_output_tokens:this.config.AI_MAX_OUTPUT_TOKENS, temperature:0.3},
    }, {signal, retries:{strategy:'none'}, timeout_ms:this.config.AI_TIMEOUT_MS});
    return {text:result.output_text ?? '', inputTokens:result.usage?.total_input_tokens,
      // total_tokens includes reasoning tokens; conservatively bill every non-input token.
      outputTokens:result.usage?.total_tokens !== undefined && result.usage.total_input_tokens !== undefined
        ? Math.max(0,result.usage.total_tokens-result.usage.total_input_tokens) : result.usage?.total_output_tokens};
  }
}

export class AiService {
  private transport?: AiTransport;
  constructor(private db: PrismaClient, public config: Config, transport?: AiTransport,
    private sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve,ms))) {
    this.transport = transport;
  }
  async json<T>(operation: string, schema: z.ZodType<T>, prompt: string, mock: () => unknown,
    tier: 'primary'|'advanced' = 'primary'): Promise<{data:T; provenance:string; model:string}> {
    const model = this.config.AI_MOCK_MODE ? 'explicit-mock-v1' : tier === 'primary' ? this.config.GEMINI_PRIMARY_MODEL : this.config.GEMINI_ADVANCED_MODEL;
    if (this.config.AI_MOCK_MODE) {
      const data = schema.parse(mock());
      await this.db.aiUsage.create({data:{operation,model,provenance:'mock',status:'success',estimatedCostUsd:0,reservedCostUsd:0,priceInput:0,priceOutput:0}});
      return {data,provenance:'mock',model};
    }
    if (!this.config.GEMINI_API_KEY) throw new AppError(503,'AI_NOT_CONFIGURED','Gemini API key is not configured');
    const inputPrice = tier === 'primary' ? this.config.AI_PRIMARY_INPUT_USD_PER_MILLION : this.config.AI_ADVANCED_INPUT_USD_PER_MILLION;
    const outputPrice = tier === 'primary' ? this.config.AI_PRIMARY_OUTPUT_USD_PER_MILLION : this.config.AI_ADVANCED_OUTPUT_USD_PER_MILLION;
    if (inputPrice === undefined || outputPrice === undefined || inputPrice <= 0 || outputPrice <= 0) {
      throw new AppError(503,'AI_PRICING_REQUIRED','Configure positive current token prices before live calls');
    }
    const jsonSchema = z.toJSONSchema(schema, {target:'draft-07'}) as Record<string, unknown>;
    // Byte count is deliberately conservative for mixed English/Vietnamese. Reserve overhead for schema and protocol.
    const inputBound = Buffer.byteLength(prompt + JSON.stringify(jsonSchema),'utf8') + 4096;
    const outputBound = this.config.AI_MAX_OUTPUT_TOKENS;
    const reservedCost = (inputBound*inputPrice + outputBound*outputPrice)/1e6;
    this.transport ??= new GeminiTransport(this.config);
    for (let retry = 0; retry <= this.config.AI_MAX_RETRIES; retry++) {
      const usage = await this.reserve(operation,model,reservedCost,inputPrice,outputPrice);
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_,reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new AppError(504,'AI_TIMEOUT','Gemini request timed out')); },this.config.AI_TIMEOUT_MS);
        });
        const result = await Promise.race([this.transport.call(model,prompt,jsonSchema,controller.signal),timeout]);
        const hasUsage = Number.isInteger(result.inputTokens) && Number.isInteger(result.outputTokens) && result.inputTokens! >= 0 && result.outputTokens! >= 0;
        const inputTokens = hasUsage ? result.inputTokens! : inputBound;
        const outputTokens = hasUsage ? result.outputTokens! : outputBound;
        await this.db.aiUsage.update({where:{id:usage.id},data:{status:'received',inputTokens,outputTokens,
          estimatedCostUsd:hasUsage ? (inputTokens*inputPrice+outputTokens*outputPrice)/1e6 : reservedCost,usageEstimated:!hasUsage}});
        let data: T;
        try { data = schema.parse(JSON.parse(result.text)); }
        catch { throw new AppError(502,'INVALID_AI_OUTPUT','Gemini returned invalid structured data'); }
        await this.db.aiUsage.update({where:{id:usage.id},data:{status:'success'}});
        return {data,provenance:'gemini',model};
      } catch (error) {
        const record = await this.db.aiUsage.findUniqueOrThrow({where:{id:usage.id}});
        await this.db.aiUsage.update({where:{id:usage.id},data:{status:error instanceof AppError ? error.code : 'provider_failure',
          // A failed/aborted call can still be billed. Retain its full reservation when usage is unknown.
          ...(record.status === 'reserved' ? {estimatedCostUsd:reservedCost,usageEstimated:true} : {})}});
        const status = typeof error === 'object' && error !== null
          ? Number('status' in error ? error.status : 'statusCode' in error ? error.statusCode : 0) : 0;
        const isTimeout = (error instanceof AppError && error.code === 'AI_TIMEOUT') ||
          (error instanceof Error && ['RequestTimeoutError','TimeoutError','APIConnectionTimeoutError'].includes(error.name));
        // Application validation failures use HTTP 502 too; they must never be treated as provider failures.
        const transient = error instanceof AppError ? error.code === 'AI_TIMEOUT'
          : isTimeout || [408,429,500,502,503,504].includes(status) || error instanceof TypeError ||
            (error instanceof Error && ['ConnectionError','APIConnectionError'].includes(error.name));
        if (!transient || retry === this.config.AI_MAX_RETRIES) {
          if (error instanceof AppError) throw error;
          if (isTimeout) throw new AppError(504,'AI_TIMEOUT','Gemini request timed out');
          throw new AppError(status === 429 ? 429 : 503,status === 429 ? 'AI_RATE_LIMITED' : 'AI_UNAVAILABLE','Gemini temporarily unavailable');
        }
        if (timer) clearTimeout(timer);
        await this.sleep(Math.min(4000,250 * 2 ** retry));
      } finally { if (timer) clearTimeout(timer); }
    }
    throw new AppError(503,'AI_UNAVAILABLE','Gemini temporarily unavailable');
  }
  private async reserve(operation:string,model:string,cost:number,priceInput:number,priceOutput:number) {
    const start = new Date(); start.setUTCHours(0,0,0,0);
    // SQLite serializes writers. The aggregate and reservation share one transaction.
    return this.db.$transaction(async tx => {
      const spent = await tx.aiUsage.aggregate({where:{createdAt:{gte:start}},_sum:{estimatedCostUsd:true}});
      if ((spent._sum.estimatedCostUsd ?? 0)+cost > this.config.AI_DAILY_BUDGET_USD) throw new AppError(429,'AI_BUDGET_EXCEEDED','Daily estimated AI budget exhausted');
      return tx.aiUsage.create({data:{operation,model,provenance:'gemini',status:'reserved',estimatedCostUsd:cost,
        reservedCostUsd:cost,priceInput,priceOutput,usageEstimated:true}});
    });
  }
}
