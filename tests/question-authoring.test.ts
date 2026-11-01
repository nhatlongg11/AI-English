import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { grammarExamples } from '../src/fixtures.js';
import { auth, teacherToken, testConfig, testDb } from './helpers.js';

const mc=()=>structuredClone(grammarExamples[0]!);
const fill=()=>({...mc(),questionType:'fill_in_blank',options:[],content:'Every Friday, Mai ____ (walk) to the library.',correctAnswer:'walks'});
const correction=()=>({...mc(),questionType:'error_correction',options:[],content:'Every morning, Mai walk to the library.',correctAnswer:'Every morning, Mai walks to the library.'});
describe('teacher question creation and atomic imports',()=>{
  let fixture:Awaited<ReturnType<typeof testDb>>;let app:Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async()=>{fixture=await testDb();app=await buildApp({db:fixture.db,config:testConfig()});});
  afterEach(async()=>{await app.close();await fixture.cleanup();});
  function post(url:string,payload:unknown,headers:Record<string,string>=auth(teacherToken)){return app.inject({method:'POST',url:`/api/v1${url}`,headers:{'content-type':'application/json',...headers},payload:JSON.stringify(payload)});}
  it('saves a teacher-authored draft with authorship, ordered options and no AI usage',async()=>{
    const response=await post('/questions',mc());expect(response.statusCode).toBe(201);
    const q=response.json().question;
    expect(q).toMatchObject({status:'draft',provenance:'teacher_manual',model:'human',createdBy:'teacher-test',reviewedBy:null});
    expect(q.options.map((o:{text:string})=>o.text)).toEqual(mc().options.map(o=>o.text));
    expect(await fixture.db.aiUsage.count()).toBe(0);
    expect((await fixture.db.question.findUniqueOrThrow({where:{id:q.id}})).createdBy).toBe('teacher-test');
  });
  it('requires staff access for creation, preview and import',async()=>{
    const student=(await post('/learning/students',{mode:'adaptive',experimentGroup:'QA'},auth())).json();
    for(const [url,payload] of [['/questions',mc()],['/questions/import/preview',{questions:[mc()]}],['/questions/import',{questions:[mc()]}]] as const){
      expect((await post(url,payload,{})).statusCode).toBe(401);
      expect((await post(url,payload,auth(student.token))).statusCode).toBe(403);
    }
    expect(await fixture.db.question.count()).toBe(0);
  });
  it('rejects spoofed publication/source metadata, invalid answer keys and missing verb cues',async()=>{
    for(const question of [{...mc(),status:'approved'},{...mc(),provenance:'gemini'},{...mc(),createdBy:'other-teacher'},{...mc(),correctAnswer:'unknown'},{...fill(),content:'Every morning, she ____ to school.'}]){
      expect((await post('/questions',question)).statusCode).toBe(400);
    }
    expect(await fixture.db.question.count()).toBe(0);
  });
  it('previews row errors and duplicates without writing anything',async()=>{
    await post('/questions',mc());
    const response=await post('/questions/import/preview',{questions:[mc(),fill(),fill(),{content:{toString:null}},correction()]});
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({invalidCount:1,duplicateCount:2,readyCount:2});
    expect(response.json().rows.map((r:{duplicate:string|null})=>r.duplicate)).toEqual(['bank',null,'file',null,null]);
    expect(response.json().rows[3].errors.length).toBeGreaterThan(0);
    expect(await fixture.db.question.count()).toBe(1);
  });
  it('aborts the entire import when any row is invalid',async()=>{
    const response=await post('/questions/import',{questions:[mc(),{...fill(),explanationVi:''}],skipDuplicates:true});
    expect(response.statusCode).toBe(400);expect(await fixture.db.question.count()).toBe(0);
  });
  it('imports mixed question types, skips only declared duplicates and is safe to replay',async()=>{
    await post('/questions',mc());
    const payload={questions:[mc(),fill(),fill(),correction()],skipDuplicates:true};
    const response=await post('/questions/import',payload);expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({skipped:2});expect(response.json().questions).toHaveLength(2);
    expect(response.json().questions.every((q:{provenance:string;createdBy:string;status:string})=>q.provenance==='teacher_import'&&q.createdBy==='teacher-test'&&q.status==='draft')).toBe(true);
    expect((await post('/questions/import',payload)).json()).toMatchObject({questions:[],skipped:4});
    expect(await fixture.db.question.count()).toBe(3);expect(await fixture.db.aiUsage.count()).toBe(0);
  });
  it('rejects duplicate imports atomically when skipDuplicates is false and enforces the batch limit',async()=>{
    await post('/questions',mc());
    expect((await post('/questions/import',{questions:[fill(),mc()],skipDuplicates:false})).statusCode).toBe(409);
    expect(await fixture.db.question.count()).toBe(1);
    expect((await post('/questions/import/preview',{questions:Array(51).fill(mc())})).statusCode).toBe(400);
  });
  it('keeps authored drafts out of assignments until explicit review, then serves without answer leakage',async()=>{
    const q=(await post('/questions',mc())).json().question;
    const student=(await post('/learning/students',{mode:'adaptive',experimentGroup:'QA'},auth())).json();
    const next=()=>app.inject({url:`/api/v1/learning/students/${student.id}/next-question`,headers:auth(student.token)});
    expect((await next()).json().question).toBeNull();
    expect((await post(`/ai/questions/${q.id}/approve`,{note:'Reviewed authored example'},auth())).statusCode).toBe(400);
    expect((await post(`/ai/questions/${q.id}/approve`,{note:'Reviewed authored example',checkedGrammarAndAnswer:true},auth())).statusCode).toBe(200);
    const assigned=(await next()).json().question;expect(assigned.id).toBe(q.id);expect(assigned.provenance).toBe('teacher_manual');
    expect(assigned).not.toHaveProperty('correctAnswer');expect(assigned).not.toHaveProperty('createdBy');
  });
});
