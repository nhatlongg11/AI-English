import type { PrismaClient } from '@prisma/client';
import { AiService } from './ai.js';
import { diagnosisSchema, hash, type Diagnosis } from './domain.js';
import { diagnosisPrompt, PROMPT_VERSION } from './prompts.js';

export const safeDiagnosis:Diagnosis = {status:'uncertain',correctedSentence:null,errorCodes:[],
  explanationVi:'Chưa đủ cơ sở để phân loại lỗi. Em hãy xem đáp án và nhờ giáo viên kiểm tra cách diễn đạt khác.'};
export class DiagnosisService {
  constructor(private db:PrismaClient,private ai:AiService) {}
  async diagnose(context:{content:string;tense:string;answer:string;correctAnswer:string}) {
    // No student identifiers enter prompts/cache keys. Raw answers belong only to deletable attempts.
    const key = hash(JSON.stringify({context,version:PROMPT_VERSION,mode:this.ai.config.AI_MOCK_MODE,
      model:this.ai.config.GEMINI_PRIMARY_MODEL}));
    const cached = await this.db.diagnosisCache.findUnique({where:{key}});
    if (cached && cached.expiresAt > new Date()) return {...diagnosisSchema.parse(JSON.parse(cached.result)),source:'cache',provenance:this.ai.config.AI_MOCK_MODE?'mock':'gemini'};
    try {
      const result = await this.ai.json('diagnose',diagnosisSchema,diagnosisPrompt(context),() => safeDiagnosis);
      // AI may repeat personal text from free-form answers. Avoid retaining diagnosis in shared cache.
      // A generic explanation cache below retains only authored, identity-free fallback feedback.
      if (result.provenance === 'mock') await this.db.diagnosisCache.upsert({where:{key},create:{key,result:JSON.stringify(result.data),expiresAt:new Date(Date.now()+86400000)},update:{result:JSON.stringify(result.data),expiresAt:new Date(Date.now()+86400000)}});
      return {...result.data,source:'ai_advisory',provenance:result.provenance};
    } catch { return {...safeDiagnosis,source:'fallback',provenance:'none'}; }
  }
}
