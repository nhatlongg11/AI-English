import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { z } from 'zod';
import { AiService } from '../src/ai.js';
import { DiagnosisService } from '../src/diagnosis.js';
import { testDb,testConfig } from './helpers.js';
describe('Gemini reliability with mocked transport only',()=>{
  let fixture:Awaited<ReturnType<typeof testDb>>;
  beforeEach(async()=>{fixture=await testDb();});afterEach(async()=>{await fixture.cleanup();});
  const schema=z.object({value:z.string()});
  const config=(extra:NodeJS.ProcessEnv={})=>testConfig({AI_MOCK_MODE:'false',GEMINI_API_KEY:'test-key-never-sent',
    AI_PRIMARY_INPUT_USD_PER_MILLION:'1',AI_PRIMARY_OUTPUT_USD_PER_MILLION:'2',AI_MAX_RETRIES:'2',...extra});
  it('records tokens, reasoning-inclusive costs, and primary provenance',async()=>{
    const call=vi.fn().mockResolvedValue({text:'{"value":"ok"}',inputTokens:100,outputTokens:50});
    const result=await new AiService(fixture.db,config(),{call}).json('test',schema,'test',()=>null);
    expect(result).toMatchObject({provenance:'gemini',model:'gemini-3.5-flash-lite'});
    expect((await fixture.db.aiUsage.findFirstOrThrow()).estimatedCostUsd).toBeCloseTo(0.0002);
  });
  it('retries rate-limit/transient responses with bounded exponential backoff without model escalation',async()=>{
    const call=vi.fn().mockRejectedValueOnce({status:429}).mockRejectedValueOnce({status:503}).mockResolvedValue({text:'{"value":"ok"}',inputTokens:1,outputTokens:1});
    const sleep=vi.fn().mockResolvedValue(undefined);
    await new AiService(fixture.db,config(),{call},sleep).json('test',schema,'test',()=>null);
    expect(call).toHaveBeenCalledTimes(3);expect(sleep.mock.calls.map(c=>c[0])).toEqual([250,500]);
    expect(call.mock.calls.every(c=>c[0]==='gemini-3.5-flash-lite')).toBe(true);
    expect(await fixture.db.aiUsage.count()).toBe(3);
  });
  it('bounds permanent and exhausted failures and retains unknown spend',async()=>{
    const call=vi.fn().mockRejectedValue({status:401,message:'secret-key'});
    await expect(new AiService(fixture.db,config(),{call}).json('test',schema,'test',()=>null)).rejects.toMatchObject({code:'AI_UNAVAILABLE'});
    expect(call).toHaveBeenCalledTimes(1);expect((await fixture.db.aiUsage.findFirstOrThrow()).usageEstimated).toBe(true);
    const failure=vi.fn().mockRejectedValue({status:503});
    await expect(new AiService(fixture.db,config(),{call:failure},async()=>{}).json('test',schema,'test',()=>null)).rejects.toMatchObject({code:'AI_UNAVAILABLE'});
    expect(failure).toHaveBeenCalledTimes(3);
  });
  it('handles SDK statusCode and named timeout/network errors',async()=>{
    const timeout=Object.assign(new Error('request deadline'),{name:'RequestTimeoutError'});
    const connection=Object.assign(new Error('network'),{name:'ConnectionError'});
    const call=vi.fn().mockRejectedValueOnce({statusCode:429}).mockRejectedValueOnce(connection).mockResolvedValue({text:'{"value":"ok"}'});
    await new AiService(fixture.db,config(),{call},async()=>{}).json('test',schema,'test',()=>null);
    expect(call).toHaveBeenCalledTimes(3);
    await expect(new AiService(fixture.db,config({AI_MAX_RETRIES:'0'}),{call:vi.fn().mockRejectedValue(timeout)}).json('test',schema,'test',()=>null)).rejects.toMatchObject({code:'AI_TIMEOUT'});
  });
  it('aborts timeout calls and bounds retries',async()=>{
    const signals:AbortSignal[]=[];
    const call=vi.fn().mockImplementation((_m,_p,_s,signal)=>{signals.push(signal);return new Promise(()=>{});});
    await expect(new AiService(fixture.db,config({AI_TIMEOUT_MS:'10',AI_MAX_RETRIES:'1'}),{call},async()=>{}).json('test',schema,'test',()=>null)).rejects.toMatchObject({code:'AI_TIMEOUT'});
    expect(call).toHaveBeenCalledTimes(2);expect(signals.every(s=>s.aborted)).toBe(true);
  });
  it('rejects malformed/invalid JSON without retrying and accounts usage',async()=>{
    for (const text of ['invalid','{"wrong":true}']) {
      const call=vi.fn().mockResolvedValue({text,inputTokens:2,outputTokens:3});
      await expect(new AiService(fixture.db,config(),{call}).json('test',schema,'test',()=>null)).rejects.toMatchObject({code:'INVALID_AI_OUTPUT'});
      expect(call).toHaveBeenCalledTimes(1);
    }
  });
  it('refuses unknown pricing or missing key, without sending a call',async()=>{
    const call=vi.fn();
    for (const extra of [{GEMINI_API_KEY:''},{AI_PRIMARY_INPUT_USD_PER_MILLION:''}]) {
      await expect(new AiService(fixture.db,config(extra),{call}).json('test',schema,'test',()=>null)).rejects.toBeDefined();
    }
    expect(call).not.toHaveBeenCalled();
  });
  it('enforces spending guard, including outstanding/failed reservations',async()=>{
    const call=vi.fn().mockResolvedValue({text:'{"value":"ok"}'});
    const service=new AiService(fixture.db,config({AI_DAILY_BUDGET_USD:'0.025'}),{call});
    await service.json('test',schema,'test',()=>null);
    await expect(service.json('test',schema,'test',()=>null)).rejects.toMatchObject({code:'AI_BUDGET_EXCEEDED'});
    expect(call).toHaveBeenCalledTimes(1);
  });
  it('reserves the shared budget atomically for concurrent requests',async()=>{
    const call=vi.fn().mockResolvedValue({text:'{"value":"ok"}'});
    const service=new AiService(fixture.db,config({AI_DAILY_BUDGET_USD:'0.025'}),{call});
    const results=await Promise.allSettled([service.json('test',schema,'test',()=>null),service.json('test',schema,'test',()=>null)]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{code:'AI_BUDGET_EXCEEDED'}});
    expect(call).toHaveBeenCalledTimes(1);
  });
  it('labels explicit mock responses and records zero cost',async()=>{
    const call=vi.fn();const result=await new AiService(fixture.db,testConfig(),{call}).json('test',schema,'test',()=>({value:'mock'}));
    expect(result.provenance).toBe('mock');expect(call).not.toHaveBeenCalled();
    expect((await fixture.db.aiUsage.findFirstOrThrow()).estimatedCostUsd).toBe(0);
  });
  it('returns safe uncertain diagnosis on provider failure',async()=>{
    const ai=new AiService(fixture.db,config({AI_MAX_RETRIES:'0'}),{call:vi.fn().mockRejectedValue({status:503})});
    const result=await new DiagnosisService(fixture.db,ai).diagnose({content:'She ____ every day.',tense:'present_simple',correctAnswer:'walks',answer:'walking'});
    expect(result).toMatchObject({status:'uncertain',errorCodes:[],source:'fallback',provenance:'none'});
  });
});
