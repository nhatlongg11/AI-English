import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { AiService } from '../src/ai.js';
import { hash } from '../src/domain.js';
import { grammarExamples } from '../src/fixtures.js';
import { QuestionService } from '../src/questions.js';
import { auth, teacherToken, testConfig, testDb } from './helpers.js';

describe('atomic administrator bulk review', () => {
  let fixture: Awaited<ReturnType<typeof testDb>>;
  let app: FastifyInstance;
  let serial: number;
  beforeEach(async () => {
    fixture=await testDb();
    app=await buildApp({db:fixture.db,config:testConfig()});
    serial=0;
  });
  afterEach(async () => {await app.close();await fixture.cleanup();});
  async function drafts(count=2,createdBy='teacher-test',word='pupil') {
    const service=new QuestionService(fixture.db,new AiService(fixture.db,testConfig()));
    return fixture.db.$transaction(Array.from({length:count},()=>fixture.db.question.create({data:{
      ...service.createData({...grammarExamples[0]!,content:`Every morning, ${word} ${serial++} ____ to school.`},'teacher_import','human'),createdBy,
    }})));
  }
  const preview=(action='approve',filters:Record<string,string>={})=>app.inject({
    method:'POST',url:'/api/v1/ai/questions/bulk-review/preview',headers:auth(),payload:{action,filters},
  });
  const review=(ids:string[],extra:Record<string,unknown>={})=>app.inject({
    method:'POST',url:'/api/v1/ai/questions/bulk-review',headers:auth(),
    payload:{ids,action:'approve',note:'Checked the complete question set and answer keys.',checkedGrammarAndAnswer:true,...extra},
  });

  it('approves all 135 drafts across API pages and records each review',async()=>{
    await drafts(135);
    expect((await app.inject({url:'/api/v1/ai/questions?limit=100',headers:auth()})).json().questions).toHaveLength(100);
    const selection=(await preview()).json();
    expect(selection).toMatchObject({matched:135,skippedOwn:0});
    expect(selection.ids).toHaveLength(135);
    expect((await review(selection.ids)).json()).toEqual({reviewed:135,status:'approved'});
    const saved=await fixture.db.question.findMany();
    expect(saved).toHaveLength(135);
    expect(saved.every(q=>q.status==='approved'&&q.reviewedBy==='admin-test'&&q.reviewedAt!==null&&q.reviewNote==='Checked the complete question set and answer keys.')).toBe(true);
  },30000);

  it('previews only matching drafts and excludes the reviewer own questions from approval',async()=>{
    const [other]=await drafts(1,'teacher-test','library visitor');
    const [own]=await drafts(1,'admin-test','library reader');
    await drafts(1,'teacher-test','football player');
    const [published]=await drafts(1,'teacher-test','library assistant');
    await fixture.db.question.update({where:{id:published!.id},data:{status:'approved'}});
    expect((await preview('approve',{tense:'present_simple',search:'LIBRARY'})).json()).toEqual({ids:[other!.id],matched:2,skippedOwn:1});
    expect((await preview('approve',{tense:'past_simple',search:'library'})).json().ids).toEqual([]);
    expect((await preview('reject',{search:'library'})).json().ids.sort()).toEqual([other!.id,own!.id].sort());
    expect((await review([other!.id,own!.id])).statusCode).toBe(403);
    expect(await fixture.db.question.count({where:{status:'draft'}})).toBe(3);
  });

  it('rejects all matching drafts with a note and no approval attestation',async()=>{
    const rows=await drafts();
    const ids=rows.map(q=>q.id);
    expect((await review(ids,{action:'reject',checkedGrammarAndAnswer:false,note:'Revise these exercises before publication.'})).json()).toEqual({reviewed:2,status:'rejected'});
    expect(await fixture.db.question.count({where:{status:'rejected',reviewedBy:'admin-test',reviewNote:'Revise these exercises before publication.'}})).toBe(2);
    expect((await preview('reject')).json()).toEqual({ids:[],matched:0,skippedOwn:0});
  });

  it('requires an admin for both preview and execution',async()=>{
    const [q]=await drafts(1);
    const studentToken='bulk-student-access-token-at-least-32-characters';
    await fixture.db.student.create({data:{tokenHash:hash(studentToken),mode:'adaptive',experimentGroup:'test'}});
    for(const token of [teacherToken,studentToken]) {
      for(const [url,payload] of [
        ['/api/v1/ai/questions/bulk-review/preview',{action:'approve',filters:{}}],
        ['/api/v1/ai/questions/bulk-review',{ids:[q!.id],action:'reject',note:'Not permitted'}],
      ] as const)expect((await app.inject({method:'POST',url,headers:auth(token),payload})).statusCode).toBe(403);
    }
    expect(await fixture.db.question.count({where:{status:'draft'}})).toBe(1);
  });

  it('rejects missing attestation, short notes, duplicate IDs and empty requests',async()=>{
    const [q]=await drafts(1);
    expect((await review([q!.id],{checkedGrammarAndAnswer:false})).json().error).toBe('REVIEW_ATTESTATION_REQUIRED');
    expect((await review([q!.id],{note:' no '})).statusCode).toBe(400);
    expect((await review([q!.id,q!.id])).statusCode).toBe(400);
    expect((await review([])).statusCode).toBe(400);
    expect(await fixture.db.question.count({where:{status:'draft'}})).toBe(1);
  });

  it('publishes none when any selected question fails answer validation',async()=>{
    const rows=await drafts();
    await fixture.db.question.update({where:{id:rows[1]!.id},data:{correctAnswer:'not one of the options'}});
    expect((await review(rows.map(q=>q.id))).statusCode).toBe(502);
    expect(await fixture.db.question.count({where:{status:'draft',reviewedBy:null}})).toBe(2);
  });

  it('uses the exact preview snapshot and rejects stale or missing targets without partial writes',async()=>{
    const [first]=await drafts(1);
    const selection=(await preview()).json();
    const [later]=await drafts(1);
    expect((await review(selection.ids)).statusCode).toBe(200);
    expect((await fixture.db.question.findUniqueOrThrow({where:{id:later!.id}})).status).toBe('draft');
    expect((await review([first!.id,later!.id])).json().error).toBe('BULK_REVIEW_CONFLICT');
    expect((await review([later!.id,randomUUID()])).json().error).toBe('BULK_REVIEW_CONFLICT');
    expect((await fixture.db.question.findUniqueOrThrow({where:{id:later!.id}})).reviewedBy).toBeNull();
  });

  it('serializes competing review operations into one complete decision',async()=>{
    const rows=await drafts();
    const results=await Promise.all([
      review(rows.map(q=>q.id)),review(rows.map(q=>q.id),{action:'reject',note:'Needs revision before publication.'}),
    ]);
    expect(results.map(r=>r.statusCode).sort()).toEqual([200,409]);
    const saved=await fixture.db.question.findMany();
    expect(new Set(saved.map(q=>q.status)).size).toBe(1);
    expect(new Set(saved.map(q=>q.reviewNote)).size).toBe(1);
  });
});
