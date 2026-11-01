import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {buildApp} from '../src/app.js';
import {grammarExamples} from '../src/fixtures.js';
import {hash} from '../src/domain.js';
import {auth,adminToken,teacherToken,testConfig,testDb} from './helpers.js';

const otherToken='test-other-teacher-credential-0123456789';
describe('staff permissions and teacher student ownership',()=>{
  let fixture:Awaited<ReturnType<typeof testDb>>;let app:Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async()=>{
    fixture=await testDb();
    const credentials=JSON.parse(testConfig().AUTH_CREDENTIALS_JSON);
    credentials.push({token:otherToken,role:'teacher',actorId:'other-teacher'});
    app=await buildApp({db:fixture.db,config:testConfig({AUTH_CREDENTIALS_JSON:JSON.stringify(credentials)})});
  });
  afterEach(async()=>{await app.close();await fixture.cleanup();});
  const post=(url:string,payload:object,token=teacherToken)=>app.inject({method:'POST',url:`/api/v1${url}`,headers:auth(token),payload});
  const get=(url:string,token=teacherToken)=>app.inject({url:`/api/v1${url}`,headers:auth(token)});
  const provision=async(token=teacherToken,extra={})=>{
    const r=await post('/learning/students',{mode:'adaptive',experimentGroup:'class_A',...extra},token);expect(r.statusCode).toBe(201);return r.json();
  };
  it('teachers cannot approve or reject any draft; a different administrator publishes it',async()=>{
    const q=(await post('/questions',grammarExamples[0]!)).json().question;
    for(const token of [teacherToken,otherToken])for(const action of ['approve','reject']){
      expect((await post(`/ai/questions/${q.id}/${action}`,{note:'Checked grammar and answer',checkedGrammarAndAnswer:true},token)).statusCode).toBe(403);
    }
    expect((await fixture.db.question.findUniqueOrThrow({where:{id:q.id}})).status).toBe('draft');
    expect((await post(`/ai/questions/${q.id}/approve`,{note:'Checked grammar and answer',checkedGrammarAndAnswer:true},adminToken)).json()).toMatchObject({status:'approved',createdBy:'teacher-test',reviewedBy:'admin-test'});
  });
  it('blocks an administrator from publishing their own manual, imported or AI draft',async()=>{
    const manual=(await post('/questions',grammarExamples[0]!,adminToken)).json().question;
    const imported=(await post('/questions/import',{questions:[{...grammarExamples[0]!,content:'Every Sunday, she ____ tennis with her cousin.'}]},adminToken)).json().questions[0];
    const generated=await post('/ai/questions/generate',{tense:'past_simple',difficulty:1,questionType:'multiple_choice',count:1},adminToken);
    expect(generated.statusCode).toBe(200);
    for(const q of [manual,imported,generated.json().questions[0]]){
      expect(q.createdBy).toBe('admin-test');
      const r=await post(`/ai/questions/${q.id}/approve`,{note:'Checked grammar and answer',checkedGrammarAndAnswer:true},adminToken);
      expect(r.statusCode).toBe(403);expect(r.json().error).toBe('SELF_REVIEW_FORBIDDEN');
    }
    expect((await post(`/ai/questions/${manual.id}/reject`,{note:'Withdraw own draft'},adminToken)).statusCode).toBe(200);
  });
  it('attributes AI questions to the authenticated teacher and rejects forged authorship',async()=>{
    const r=await post('/ai/questions/generate',{tense:'present_simple',difficulty:1,questionType:'multiple_choice',count:1});
    expect(r.json().questions[0].createdBy).toBe('teacher-test');
    expect((await post('/questions',{...grammarExamples[0]!,createdBy:'admin-test'})).statusCode).toBe(400);
  });
  it('includes zero-attempt students and paginates only the current teacher roster without secrets',async()=>{
    const a=await provision(),b=await provision();await provision(otherToken);await provision(adminToken);
    const page=await get('/learning/students?limit=1');expect(page.json().students).toHaveLength(1);expect(page.json().nextOffset).toBe(1);
    const second=await get('/learning/students?limit=1&offset=1');
    expect(new Set([...page.json().students,...second.json().students].map((s:{id:string})=>s.id))).toEqual(new Set([a.id,b.id]));
    expect(page.json().students[0]).toMatchObject({teacherId:'teacher-test',total:0,confirmed:0,correct:0});
    expect(page.body).not.toContain('tokenHash');expect(page.body).not.toContain(a.token);
    expect((await get('/learning/students',adminToken)).json().students).toHaveLength(4);
    expect((await get('/learning/students?offset=2')).json().students).toEqual([]);
  });
  it('teachers cannot forge ownership or reassign students; admins can assign and unassign',async()=>{
    for(const teacherId of ['other-teacher',null])expect((await post('/learning/students',{mode:'adaptive',experimentGroup:'A',teacherId})).statusCode).toBe(403);
    expect((await post('/learning/students',{mode:'adaptive',experimentGroup:'A',teacherId:'missing'},adminToken)).statusCode).toBe(400);
    const s=await provision(adminToken);const url=`/api/v1/learning/students/${s.id}/teacher`;
    expect((await app.inject({method:'PATCH',url,headers:auth(teacherToken),payload:{teacherId:'teacher-test'}})).statusCode).toBe(403);
    expect((await app.inject({method:'PATCH',url,headers:auth(),payload:{teacherId:'teacher-test'}})).statusCode).toBe(200);
    expect((await get('/learning/students')).json().students.map((s:{id:string})=>s.id)).toContain(s.id);
    await app.inject({method:'PATCH',url,headers:auth(),payload:{teacherId:null}});
    expect((await get('/learning/students')).json().students).toEqual([]);
    const teachers=await get('/learning/teachers',adminToken);expect(teachers.json().teachers).toHaveLength(2);expect(teachers.body).not.toContain(teacherToken);
    expect((await get('/learning/teachers')).statusCode).toBe(403);
  });
  it('scopes report rows, CSV, counts and pagination in the database before export',async()=>{
    const q=(await post('/questions',grammarExamples[0]!)).json().question;
    await post(`/ai/questions/${q.id}/approve`,{note:'Checked grammar and answer',checkedGrammarAndAnswer:true},adminToken);
    const a=await provision(),b=await provision(otherToken),unassigned=await provision(adminToken);
    for(const s of [a,b,unassigned]){
      const decision=await fixture.db.selectionDecision.create({data:{studentId:s.id,questionId:q.id,mode:'adaptive',algorithm:'test',reason:'{}'}});
      await fixture.db.attempt.create({data:{studentId:s.id,questionId:q.id,decisionId:decision.id,answer:'private answer',correct:true,diagnosis:'{}',gradingSource:'stored_option_key',mode:'adaptive'}});
    }
    const report=await get('/learning/reports?limit=1');expect(report.json().rows.map((r:{anonymousStudentId:string})=>r.anonymousStudentId)).toEqual([a.id]);
    expect((await get('/learning/reports?limit=1&offset=1')).json().rows).toEqual([]);
    const csv=await get('/learning/reports?format=csv');expect(csv.body).toContain(a.id);expect(csv.body).not.toContain(b.id);expect(csv.body).not.toContain(unassigned.id);expect(csv.body).not.toContain('private answer');
    expect((await get('/learning/reports',otherToken)).json().rows.map((r:{anonymousStudentId:string})=>r.anonymousStudentId)).toEqual([b.id]);
    expect((await get('/learning/students')).json().students[0]).toMatchObject({total:1,confirmed:1,correct:1});
    expect((await get('/research/export')).statusCode).toBe(403);
    expect((await get('/research/export',adminToken)).json().rows).toHaveLength(3);
  });
  it('denies student access to staff routes and keeps legacy unassigned students admin-only',async()=>{
    const s=await provision();
    for(const route of ['/learning/students','/learning/reports','/learning/teachers','/research/export'])expect((await get(route,s.token)).statusCode).toBe(403);
    expect((await post('/learning/students',{mode:'adaptive',experimentGroup:'A'},s.token)).statusCode).toBe(403);
    const legacy=await fixture.db.student.create({data:{tokenHash:hash('legacy-only'),mode:'baseline',experimentGroup:'old'}});
    expect((await get('/learning/students')).json().students.map((s:{id:string})=>s.id)).not.toContain(legacy.id);
    expect((await get('/learning/students',adminToken)).json().students.map((s:{id:string})=>s.id)).toContain(legacy.id);
  });
});
