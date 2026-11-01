import { beforeEach,afterEach,describe,it,expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { testDb,testConfig,auth,teacherToken } from './helpers.js';

describe('persistent API integration',()=>{
  let fixture:Awaited<ReturnType<typeof testDb>>;
  let app:FastifyInstance;
  beforeEach(async()=>{fixture=await testDb();app=await buildApp({db:fixture.db,config:testConfig()});});
  afterEach(async()=>{await app.close();await fixture.cleanup();});
  const request={tense:'present_simple',difficulty:1,questionType:'multiple_choice',count:3};
  async function generate() {const r=await app.inject({method:'POST',url:'/api/v1/ai/questions/generate',headers:auth(teacherToken),payload:request});expect(r.statusCode).toBe(200);return r.json().questions as {id:string;correctAnswer:string;options:{text:string;errorCode:string|null}[]}[];}
  async function student(mode='adaptive') {const r=await app.inject({method:'POST',url:'/api/v1/learning/students',headers:auth(),payload:{mode,experimentGroup:mode==='adaptive'?'A':'B'}});expect(r.statusCode).toBe(201);return r.json() as {id:string;token:string};}
  async function approve(id:string) {return app.inject({method:'POST',url:`/api/v1/ai/questions/${id}/approve`,headers:auth(),payload:{note:'Checked mock example for integration test',checkedGrammarAndAnswer:true}});}
  it('starts and checks database health',async()=>expect((await app.inject('/api/v1/health')).json()).toMatchObject({status:'ok',aiMode:'explicit_mock'}));
  it('enforces authorization and advanced-model admin control',async()=>{
    expect((await app.inject('/api/v1/ai/questions')).statusCode).toBe(401);
    expect((await app.inject({method:'POST',url:'/api/v1/ai/questions/generate',headers:auth(teacherToken),payload:{...request,modelTier:'advanced'}})).statusCode).toBe(403);
    const s=await student();
    expect((await app.inject({method:'POST',url:'/api/v1/ai/questions/generate',headers:auth(s.token),payload:request})).statusCode).toBe(403);
    expect((await app.inject({url:'/api/v1/ai/usage',headers:auth(teacherToken)})).statusCode).toBe(403);
  });
  it('stores mock questions as drafts; rejects duplicate batches atomically',async()=>{
    const qs=await generate();
    expect(await fixture.db.question.count({where:{status:'draft',provenance:'mock'}})).toBe(3);
    expect((await app.inject({method:'POST',url:'/api/v1/ai/questions/generate',headers:auth(),payload:request})).statusCode).toBe(409);
    expect(await fixture.db.question.count()).toBe(3);expect(qs).toHaveLength(3);
  });
  it('requires review attestation and forbids re-review and rejected publication',async()=>{
    const qs=await generate();
    expect((await app.inject({method:'POST',url:`/api/v1/ai/questions/${qs[0]!.id}/approve`,headers:auth(),payload:{note:'Review'}})).statusCode).toBe(400);
    expect((await approve(qs[0]!.id)).json()).toMatchObject({status:'approved',reviewedBy:'admin-test'});
    expect((await approve(qs[0]!.id)).statusCode).toBe(409);
    expect((await app.inject({method:'POST',url:`/api/v1/ai/questions/${qs[1]!.id}/reject`,headers:auth(),payload:{note:'Ambiguous question'}})).json().status).toBe('rejected');
    expect((await approve(qs[1]!.id)).statusCode).toBe(409);
  });
  it('does not serve drafts, leaks no answer key, grades known error and updates mastery without AI calls',async()=>{
    const qs=await generate();const s=await student();
    const url=`/api/v1/learning/students/${s.id}/next-question`;
    expect((await app.inject({url,headers:auth(s.token)})).json().question).toBeNull();
    for (const q of qs) expect((await approve(q.id)).statusCode).toBe(200);
    const next=(await app.inject({url,headers:auth(s.token)})).json();
    expect(next.question.correctAnswer).toBeUndefined();expect(next.question.explanationVi).toBeUndefined();
    expect(next.question.options.every((v:unknown)=>typeof v==='string')).toBe(true);
    expect((await app.inject({url,headers:auth(s.token)})).json().decisionId).toBe(next.decisionId);
    const usage=await fixture.db.aiUsage.count();
    const chosen=qs.find(q=>q.id===next.question.id)!;
    const wrong=chosen.options.find(o=>o.errorCode)!;
    const response=await app.inject({method:'POST',url:'/api/v1/learning/attempts',headers:auth(s.token),payload:{decisionId:next.decisionId,answer:wrong.text}});
    expect(response.statusCode).toBe(200);expect(response.json()).toMatchObject({correct:false,gradingSource:'stored_option_key',diagnosis:{errorCodes:['E01']}});
    expect(await fixture.db.aiUsage.count()).toBe(usage);
    expect((await fixture.db.masterySnapshot.findFirstOrThrow()).mastery).toBe(0);
    expect((await app.inject({method:'POST',url:'/api/v1/learning/attempts',headers:auth(s.token),payload:{decisionId:next.decisionId,answer:chosen.correctAnswer}})).statusCode).toBe(409);
  });
  it('grades correct MC and prevents arbitrary option injection',async()=>{
    const qs=await generate();for(const q of qs) await approve(q.id);const s=await student('baseline');
    const next=(await app.inject({url:`/api/v1/learning/students/${s.id}/next-question`,headers:auth(s.token)})).json();
    expect((await app.inject({method:'POST',url:'/api/v1/learning/attempts',headers:auth(s.token),payload:{decisionId:next.decisionId,answer:'arbitrary'}})).statusCode).toBe(400);
    const response=await app.inject({method:'POST',url:'/api/v1/learning/attempts',headers:auth(s.token),payload:{decisionId:next.decisionId,answer:qs.find(q=>q.id===next.question.id)!.correctAnswer.toUpperCase()}});
    expect(response.json()).toMatchObject({correct:true,mastery:{mastery:1}});
    expect((await fixture.db.attempt.findFirstOrThrow()).mode).toBe('baseline');
  });
  it('protects student records and submitted diagnosis ownership',async()=>{
    const a=await student(),b=await student();
    expect((await app.inject({url:`/api/v1/learning/students/${a.id}/mastery`,headers:auth(b.token)})).statusCode).toBe(403);
    expect((await app.inject({url:`/api/v1/learning/students/${a.id}/mastery`,headers:auth(teacherToken)})).statusCode).toBe(403);
    expect((await app.inject({method:'POST',url:'/api/v1/ai/diagnose',headers:auth(a.token),payload:{attemptId:crypto.randomUUID()}})).statusCode).toBe(404);
  });
  it('persists across connections, exports de-identified data and deletes learner records',async()=>{
    const qs=await generate();for(const q of qs) await approve(q.id);const s=await student();
    const next=(await app.inject({url:`/api/v1/learning/students/${s.id}/next-question`,headers:auth(s.token)})).json();
    await app.inject({method:'POST',url:'/api/v1/learning/attempts',headers:auth(s.token),payload:{decisionId:next.decisionId,answer:qs.find(q=>q.id===next.question.id)!.correctAnswer}});
    const second=createDb(fixture.url);expect(await second.attempt.count()).toBe(1);await second.$disconnect();
    const exported=await app.inject({url:'/api/v1/research/export',headers:auth()});
    expect(exported.json().rows).toHaveLength(1);expect(exported.body).not.toContain('tokenHash');expect(exported.body).not.toContain('correctAnswer');
    expect((await app.inject({url:'/api/v1/research/export?format=csv',headers:auth()})).body).toContain('anonymousStudentId');
    expect((await app.inject({url:'/api/v1/research/export',headers:auth(s.token)})).statusCode).toBe(403);
    expect((await app.inject({method:'DELETE',url:`/api/v1/learning/students/${s.id}`,headers:auth(s.token)})).statusCode).toBe(204);
    expect(await fixture.db.attempt.count()).toBe(0);expect(await fixture.db.selectionDecision.count()).toBe(0);expect(await fixture.db.masterySnapshot.count()).toBe(0);
    expect((await app.inject({url:`/api/v1/learning/students/${s.id}/mastery`,headers:auth(s.token)})).statusCode).toBe(401);
  });
  it('limits request bodies and AI endpoint rate',async()=>{
    expect((await app.inject({method:'POST',url:'/api/v1/ai/questions/generate',headers:auth(),payload:{...request,vocabularyTheme:'x'.repeat(20000)}})).statusCode).toBe(413);
    await app.close();app=await buildApp({db:fixture.db,config:testConfig({AI_RATE_LIMIT_PER_MINUTE:'1'})});
    expect((await app.inject({method:'POST',url:'/api/v1/ai/questions/generate',headers:auth(),payload:request})).statusCode).toBe(200);
    expect((await app.inject({method:'POST',url:'/api/v1/ai/questions/generate',headers:auth(),payload:request})).statusCode).toBe(429);
  });
  it('keeps nonmatching free text uncertain and reuses feedback after submission',async()=>{
    const result=await app.inject({method:'POST',url:'/api/v1/ai/questions/generate',headers:auth(teacherToken),payload:{...request,questionType:'fill_in_blank',count:1}});
    const q=result.json().questions[0];await approve(q.id);const s=await student();
    const next=(await app.inject({url:`/api/v1/learning/students/${s.id}/next-question`,headers:auth(s.token)})).json();
    const response=await app.inject({method:'POST',url:'/api/v1/learning/attempts',headers:auth(s.token),payload:{decisionId:next.decisionId,answer:'maybe walking'}});
    expect(response.json()).toMatchObject({correct:null,requiresTeacherReview:true,diagnosis:{status:'uncertain',provenance:'mock'}});
    expect(await fixture.db.masterySnapshot.count()).toBe(0);
    const count=await fixture.db.aiUsage.count();
    expect((await app.inject({method:'POST',url:'/api/v1/ai/diagnose',headers:auth(s.token),payload:{attemptId:response.json().attemptId}})).statusCode).toBe(200);
    expect(await fixture.db.aiUsage.count()).toBe(count);
  });
});
