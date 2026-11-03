import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import {buildApp} from '../src/app.js';
import {grammarExamples} from '../src/fixtures.js';
import {auth,teacherToken,adminToken,testConfig,testDb} from './helpers.js';

const otherToken='other-teacher-classroom-0123456789-abcdef';
describe('lesson attendance and teacher-assigned exercises',()=>{
  let fixture:Awaited<ReturnType<typeof testDb>>;let app:Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async()=>{fixture=await testDb();const credentials=JSON.parse(testConfig().AUTH_CREDENTIALS_JSON);credentials.push({token:otherToken,role:'teacher',actorId:'other-teacher'});app=await buildApp({db:fixture.db,config:testConfig({AUTH_CREDENTIALS_JSON:JSON.stringify(credentials)})});});
  afterEach(async()=>{await app.close();await fixture.cleanup();});
  const call=(path:string,method:'GET'|'POST'|'PATCH'='GET',payload?:object,token=teacherToken)=>app.inject({url:'/api/v1'+path,method,headers:auth(token),payload});
  async function student(token=teacherToken){const r=await call('/learning/students','POST',{mode:'adaptive',experimentGroup:'test_class',displayName:'Student alias'},token);expect(r.statusCode).toBe(201);return r.json() as {id:string;token:string};}
  async function question(approved=true){const r=await call('/questions','POST',grammarExamples[0]!);expect(r.statusCode).toBe(201);const q=r.json().question;if(approved)expect((await call(`/ai/questions/${q.id}/approve`,'POST',{note:'Administrator checked this test fixture',checkedGrammarAndAnswer:true},adminToken)).statusCode).toBe(200);return q;}
  async function exercise(studentIds:string[],questionIds:string[]){const r=await call('/teaching/exercises','POST',{title:'Practice lesson',instructions:'Read carefully.',studentIds,questionIds});expect(r.statusCode).toBe(201);return r.json().exercise;}
  it('creates a register with explicit unmarked entries, persists attendance and records the marker',async()=>{
    const a=await student(),b=await student();
    const r=await call('/teaching/lessons','POST',{title:'Lesson one',heldOn:'2026-10-28',studentIds:[a.id,b.id]});expect(r.statusCode).toBe(201);const id=r.json().lesson.id;
    const detail=(await call(`/teaching/lessons/${id}`)).json().lesson;
    expect(detail.records.every((r:{status:string;markedAt:null})=>r.status==='unmarked'&&r.markedAt===null)).toBe(true);
    expect(JSON.stringify(detail)).not.toContain('tokenHash');expect(JSON.stringify(detail)).not.toContain(a.token);
    expect((await call(`/teaching/lessons/${id}/attendance`,'PATCH',{records:[{studentId:a.id,status:'present'},{studentId:b.id,status:'absent'}]})).statusCode).toBe(200);
    expect((await call('/teaching/lessons')).json().lessons[0]).toMatchObject({total:2,marked:2});
    const record=await fixture.db.attendanceRecord.findUniqueOrThrow({where:{lessonId_studentId:{lessonId:id,studentId:a.id}}});expect(record).toMatchObject({status:'present',markedBy:'teacher-test'});expect(record.markedAt).not.toBeNull();
    expect((await call(`/teaching/lessons/${id}/attendance`,'PATCH',{records:[{studentId:a.id,status:'late'},{studentId:b.id,status:'excused'}]})).statusCode).toBe(200);
    const reset=await call(`/teaching/lessons/${id}/attendance`,'PATCH',{records:[{studentId:a.id,status:'unmarked'}]});expect(reset.json().lesson.records.find((r:{studentId:string})=>r.studentId===a.id).status).toBe('unmarked');
  });
  it('rejects invalid calendar dates, duplicate students and forged markers',async()=>{
    const s=await student();const data={title:'Lesson',heldOn:'2026-02-30',studentIds:[s.id]};
    expect((await call('/teaching/lessons','POST',data)).statusCode).toBe(400);
    expect((await call('/teaching/lessons','POST',{...data,heldOn:'2026-10-28',studentIds:[s.id,s.id]})).statusCode).toBe(400);
    expect((await call('/teaching/lessons','POST',{...data,heldOn:'2026-10-28',createdBy:'other'})).statusCode).toBe(400);
  });
  it('enforces ownership and atomic attendance changes, including students transferred away',async()=>{
    const a=await student(),b=await student(otherToken);
    expect((await call('/teaching/lessons','POST',{title:'Lesson',heldOn:'2026-10-28',studentIds:[a.id,b.id]})).statusCode).toBe(403);
    const lesson=(await call('/teaching/lessons','POST',{title:'Lesson',heldOn:'2026-10-28',studentIds:[a.id]})).json().lesson;
    expect((await call(`/teaching/lessons/${lesson.id}`,'GET',undefined,otherToken)).statusCode).toBe(404);
    expect((await call(`/teaching/lessons/${lesson.id}/attendance`,'PATCH',{records:[{studentId:a.id,status:'present'},{studentId:b.id,status:'present'}]})).statusCode).toBe(403);
    expect((await fixture.db.attendanceRecord.findFirstOrThrow()).status).toBe('unmarked');
    expect((await call('/teaching/lessons','GET',undefined,a.token)).statusCode).toBe(403);
    await fixture.db.student.update({where:{id:a.id},data:{teacherId:'other-teacher'}});
    expect((await call(`/teaching/lessons/${lesson.id}`)).json().lesson.records).toEqual([]);
    expect((await call(`/teaching/lessons/${lesson.id}`,'GET',undefined,adminToken)).json().lesson.records).toHaveLength(1);
  });
  it('keeps exercise drafts private and blocks assigning questions that await administrator approval',async()=>{
    const a=await student();const q=await question(false);const e=await exercise([a.id],[q.id]);
    expect((await call('/learning/exercises','GET',undefined,a.token)).json().exercises).toEqual([]);
    expect((await call(`/learning/exercises/${e.id}/next-question`,'GET',undefined,a.token)).statusCode).toBe(404);
    const blocked=await call(`/teaching/exercises/${e.id}/publish`,'POST');expect(blocked.statusCode).toBe(409);expect(blocked.json().error).toBe('QUESTIONS_AWAITING_APPROVAL');
    expect((await call(`/ai/questions/${q.id}/approve`,'POST',{note:'Cannot approve own question',checkedGrammarAndAnswer:true})).statusCode).toBe(403);
    await call(`/ai/questions/${q.id}/approve`,'POST',{note:'Administrator review complete',checkedGrammarAndAnswer:true},adminToken);
    expect((await call(`/teaching/exercises/${e.id}/publish`,'POST')).statusCode).toBe(200);
    expect((await call('/learning/exercises','GET',undefined,a.token)).json().exercises[0]).toMatchObject({id:e.id,questionCount:1,answered:0});
  });
  it('preserves order, resumes one decision, grades once, completes and reports actual recipient progress',async()=>{
    const a=await student(),outsider=await student();const q=await question();
    const second=(await call('/questions','POST',grammarExamples[1]!)).json().question;
    await call(`/ai/questions/${second.id}/approve`,'POST',{note:'Administrator review complete',checkedGrammarAndAnswer:true},adminToken);
    const e=await exercise([a.id],[second.id,q.id]);await call(`/teaching/exercises/${e.id}/publish`,'POST');
    expect((await call(`/learning/exercises/${e.id}/next-question`,'GET',undefined,outsider.token)).statusCode).toBe(404);
    const next=async()=>(await call(`/learning/exercises/${e.id}/next-question`,'GET',undefined,a.token)).json();
    const first=await next();expect(first.question.id).toBe(second.id);expect(first.question).not.toHaveProperty('correctAnswer');expect(first.question).not.toHaveProperty('createdBy');expect(first.question.options.every((o:unknown)=>typeof o==='string')).toBe(true);
    expect((await next()).decisionId).toBe(first.decisionId);
    const ordinary=(await call(`/learning/students/${a.id}/next-question`,'GET',undefined,a.token)).json();expect(ordinary.decisionId).not.toBe(first.decisionId);
    const submit=(id:string,answer:string)=>call('/learning/attempts','POST',{decisionId:id,answer},a.token);
    expect((await submit(first.decisionId,second.correctAnswer)).json().correct).toBe(true);
    expect((await submit(first.decisionId,second.correctAnswer)).statusCode).toBe(409);
    const nextQuestion=await next();expect(nextQuestion.question.id).toBe(q.id);expect(nextQuestion.exercise.answered).toBe(1);
    await submit(nextQuestion.decisionId,q.correctAnswer);expect(await next()).toMatchObject({completed:true,question:null,exercise:{answered:2,total:2}});
    const detail=(await call(`/teaching/exercises/${e.id}`)).json().exercise;expect(detail.recipients[0]).toMatchObject({answered:2,correct:2,pending:0});
    expect((await call('/learning/exercises','GET',undefined,a.token)).json().exercises[0]).toMatchObject({answered:2,correct:2});
    expect(await fixture.db.aiUsage.count()).toBe(0);
    expect((await call(`/teaching/exercises/${e.id}`,'PATCH',{title:'Changed',instructions:'',studentIds:[a.id],questionIds:[q.id]})).statusCode).toBe(409);
    expect((await call(`/teaching/exercises/${e.id}/publish`,'POST')).statusCode).toBe(200);
  });
  it('allows draft edits but prevents other teachers reading or assigning another teacher students',async()=>{
    const a=await student(),other=await student(otherToken);const q=await question();const e=await exercise([a.id],[q.id]);
    expect((await call('/teaching/exercises','POST',{title:'Wrong recipient',instructions:'',studentIds:[other.id],questionIds:[q.id]})).statusCode).toBe(403);
    expect((await call(`/teaching/exercises/${e.id}`,'GET',undefined,otherToken)).statusCode).toBe(404);
    expect((await call(`/teaching/exercises/${e.id}/publish`,'POST',undefined,otherToken)).statusCode).toBe(404);
    expect((await call(`/teaching/exercises/${e.id}`,'PATCH',{title:'Updated draft',instructions:'Try it.',studentIds:[a.id],questionIds:[q.id]})).json().exercise.title).toBe('Updated draft');
    expect((await call('/teaching/exercises','GET',undefined,a.token)).statusCode).toBe(403);
    expect((await call('/learning/exercises')).statusCode).toBe(403);
    await fixture.db.student.update({where:{id:a.id},data:{teacherId:'other-teacher'}});
    expect((await call(`/teaching/exercises/${e.id}/publish`,'POST')).statusCode).toBe(403);
    expect((await call(`/teaching/exercises/${e.id}`)).json().exercise.recipients).toEqual([]);
  });
  it('rejects duplicate questions, empty exercises, rejected questions and invalid attendance rows',async()=>{
    const a=await student();const q=await question(false);
    const body={title:'Exercise',instructions:'',studentIds:[a.id],questionIds:[q.id]};
    expect((await call('/teaching/exercises','POST',{...body,questionIds:[q.id,q.id]})).statusCode).toBe(400);
    expect((await call('/teaching/exercises','POST',{...body,studentIds:[]})).statusCode).toBe(400);
    await call(`/ai/questions/${q.id}/reject`,'POST',{note:'Question rejected for test'},adminToken);
    expect((await call('/teaching/exercises','POST',body)).statusCode).toBe(400);
    const lesson=(await call('/teaching/lessons','POST',{title:'Lesson',heldOn:'2026-10-28',studentIds:[a.id]})).json().lesson;
    expect((await call(`/teaching/lessons/${lesson.id}/attendance`,'PATCH',{records:[{studentId:a.id,status:'online'}]})).statusCode).toBe(400);
    expect((await call(`/teaching/lessons/${lesson.id}/attendance`,'PATCH',{records:[{studentId:a.id,status:'present',markedBy:'admin'}]})).statusCode).toBe(400);
  });
  it('stores optional names only in staff views and allows only the responsible teacher to change them',async()=>{
    const a=await student();expect((await call(`/learning/students/${a.id}/profile`,'PATCH',{displayName:'Nguyễn Minh Anh',className:'8A1'})).statusCode).toBe(200);
    expect((await call(`/learning/students/${a.id}/profile`,'PATCH',{displayName:'Minh Anh'})).statusCode).toBe(200);
    expect((await call(`/learning/students/${a.id}/profile`,'PATCH',{displayName:'Other'},otherToken)).statusCode).toBe(404);
    expect((await call(`/learning/students/${a.id}/profile`,'PATCH',{displayName:'Self'},a.token)).statusCode).toBe(403);
    expect((await call('/learning/students')).json().students[0].displayName).toBe('Minh Anh');
    expect((await call('/learning/students')).json().students[0].className).toBe('8A1');
    expect((await call(`/learning/students/${a.id}/profile`,'PATCH',{})).statusCode).toBe(400);
    expect((await call(`/learning/students/${a.id}/profile`,'PATCH',{className:' '})).statusCode).toBe(400);
    expect((await call(`/learning/students/${a.id}/profile`,'PATCH',{className:'other'},otherToken)).statusCode).toBe(404);
    const lesson=(await call('/teaching/lessons','POST',{title:'Class check',heldOn:'2026-10-28',studentIds:[a.id]})).json().lesson;
    expect((await call(`/teaching/lessons/${lesson.id}`)).json().lesson.records[0].student.className).toBe('8A1');
    const session=(await call('/auth/session','GET',undefined,a.token)).json();expect(session).not.toHaveProperty('displayName');
  });
  it('saves lesson reports without changing attendance or app grades, and keeps missing scores distinct from zero',async()=>{
    const a=await student(),b=await student();
    const lesson=(await call('/teaching/lessons','POST',{title:'Buổi 5',heldOn:'2026-11-03',studentIds:[a.id,b.id]})).json().lesson;
    const path=`/teaching/lessons/${lesson.id}`;
    const fresh=(await call(path)).json().lesson;expect(fresh).toMatchObject({vocabularyTotal:null,reportClassName:null});
    expect(fresh.records.every((r:{vocabularyKnown:null;miniTestScore:null;homeworkStatus:string})=>r.vocabularyKnown===null&&r.miniTestScore===null&&r.homeworkStatus==='unmarked')).toBe(true);
    await call(path+'/attendance','PATCH',{records:[{studentId:a.id,status:'late'},{studentId:b.id,status:'excused'}]});
    const data={reportClassName:'Lớp 7',vocabularyTotal:15,records:[{studentId:a.id,homeworkStatus:'complete',vocabularyKnown:0,miniTestScore:5.5},{studentId:b.id,homeworkStatus:'partial',vocabularyKnown:null,miniTestScore:null}]};
    const saved=await call(path+'/report','PATCH',data);expect(saved.statusCode).toBe(200);
    expect(saved.json().lesson.records.find((r:{studentId:string})=>r.studentId===a.id)).toMatchObject({status:'late',vocabularyKnown:0,miniTestScore:5.5,homeworkStatus:'complete',reportedBy:'teacher-test'});
    expect((await call(path)).json().lesson).toMatchObject({vocabularyTotal:15,reportClassName:'Lớp 7'});
    expect(await fixture.db.attempt.count()).toBe(0);expect(await fixture.db.aiUsage.count()).toBe(0);
    const cleared=await call(path+'/report','PATCH',{...data,vocabularyTotal:null,records:data.records.map(r=>({...r,vocabularyKnown:null,miniTestScore:null}))});expect(cleared.statusCode).toBe(200);
    expect(cleared.json().lesson.records.every((r:{vocabularyKnown:null})=>r.vocabularyKnown===null)).toBe(true);
  });
  it('rejects invalid report scores, forged metadata, foreign students and cross-account access atomically',async()=>{
    const a=await student(),b=await student(otherToken);
    const lesson=(await call('/teaching/lessons','POST',{title:'Buổi 7',heldOn:'2026-11-03',studentIds:[a.id]})).json().lesson;
    const path=`/teaching/lessons/${lesson.id}/report`;
    const row={studentId:a.id,homeworkStatus:'complete',vocabularyKnown:14,miniTestScore:0};const data={reportClassName:'7A',vocabularyTotal:15,records:[row]};
    for(const change of [{vocabularyKnown:16},{vocabularyKnown:1.5},{miniTestScore:10.1},{miniTestScore:-1},{homeworkStatus:'online'},{reportedBy:'admin'}])expect((await call(path,'PATCH',{...data,records:[{...row,...change}]})).statusCode).toBe(400);
    expect((await call(path,'PATCH',{...data,vocabularyTotal:null})).statusCode).toBe(400);
    expect((await call(path,'PATCH',{...data,records:[row,row]})).statusCode).toBe(400);
    expect((await call(path,'PATCH',{...data,records:[row,{...row,studentId:b.id}]})).statusCode).toBe(403);
    const outsider=await student();expect((await call(path,'PATCH',{...data,records:[row,{...row,studentId:outsider.id}]})).statusCode).toBe(400);
    expect((await call(path,'PATCH',data,otherToken)).statusCode).toBe(404);
    expect((await call(path,'PATCH',data,a.token)).statusCode).toBe(403);
    expect((await call(`/teaching/lessons/${lesson.id}`,'GET',undefined,a.token)).statusCode).toBe(403);
    expect((await fixture.db.attendanceLesson.findUniqueOrThrow({where:{id:lesson.id}})).vocabularyTotal).toBeNull();
    expect((await fixture.db.attendanceRecord.findFirstOrThrow()).vocabularyKnown).toBeNull();
    expect((await call(path,'PATCH',data)).statusCode).toBe(200);
    await fixture.db.student.update({where:{id:a.id},data:{teacherId:'other-teacher'}});
    expect((await call(path,'PATCH',data)).statusCode).toBe(403);
    expect((await call(`/teaching/lessons/${lesson.id}`)).json().lesson.records).toEqual([]);
    expect((await call(path,'PATCH',data,adminToken)).statusCode).toBe(200);
    expect((await call(`/teaching/lessons/${lesson.id}`,'GET',undefined,adminToken)).json().lesson.records[0]).toMatchObject({vocabularyKnown:14,miniTestScore:0,reportedBy:'admin-test'});
  });
  it('preserves transferred students scores when a teacher changes the shared vocabulary total',async()=>{
    const a=await student(),b=await student();const lesson=(await call('/teaching/lessons','POST',{title:'Buổi 8',heldOn:'2026-11-03',studentIds:[a.id,b.id]})).json().lesson;
    const row={studentId:a.id,homeworkStatus:'complete',vocabularyKnown:15,miniTestScore:null};const data={reportClassName:'7A',vocabularyTotal:15,records:[row,{...row,studentId:b.id}]};
    expect((await call(`/teaching/lessons/${lesson.id}/report`,'PATCH',data)).statusCode).toBe(200);
    await fixture.db.student.update({where:{id:b.id},data:{teacherId:'other-teacher'}});
    const conflict=await call(`/teaching/lessons/${lesson.id}/report`,'PATCH',{...data,vocabularyTotal:10,records:[{...row,vocabularyKnown:10}]});
    expect(conflict.statusCode).toBe(409);expect(conflict.json().error).toBe('REPORT_TOTAL_CONFLICT');
    expect((await fixture.db.attendanceLesson.findUniqueOrThrow({where:{id:lesson.id}})).vocabularyTotal).toBe(15);
    expect((await fixture.db.attendanceRecord.findUniqueOrThrow({where:{lessonId_studentId:{lessonId:lesson.id,studentId:a.id}}})).vocabularyKnown).toBe(15);
  });
});
