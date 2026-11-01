import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import type {Assignment,BankQuestion,Feedback,ResearchRow} from '../frontend/src/types.js';

// Uses existing local accounts, Vite proxy, running Fastify and the real SQLite DB.
// A disposable learner answers an already approved question; no Gemini calls.
const origin='http://127.0.0.1:5173';
const manifest=JSON.parse(await readFile('.tmp/local-accounts.json','utf8')) as {accounts:{role:string;actorId:string;token:string}[]};
const teacherAccount=manifest.accounts.find(a=>a.role==='teacher')!;
const adminAccount=manifest.accounts.find(a=>a.role==='admin')!;
assert(teacherAccount&&adminAccount,'Run npm run db:seed:accounts first');
async function request<T>(token:string,path:string,method='GET',body?:object,expected=200):Promise<T>{
  const response=await fetch(`${origin}/api/v1${path}`,{method,headers:{authorization:`Bearer ${token}`,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  const data=response.status===204?null:await response.json();
  assert.equal(response.status,expected,`${path}: expected ${expected}, received ${response.status}, code ${data?.error??'none'}`);
  return data as T;
}
const teacherToken=teacherAccount.token,adminToken=adminAccount.token;
type Student={id:string;teacherId:string|null;total:number;confirmed:number;correct:number};
const rosterFor=(token:string)=>request<{students:Student[]}>(token,'/learning/students');
const reportFor=(token:string)=>request<{rows:ResearchRow[]}>(token,'/learning/reports');
const questions=()=>request<{questions:BankQuestion[]}>(teacherToken,'/ai/questions?limit=100');
const usage=()=>request<{totals:{_count:number}}>(adminToken,'/ai/usage');
let temporaryStudent:string|undefined;
try {
  assert.equal((await fetch(`${origin}/teacher/students`)).status,200);
  const health=await request<{status:string;aiMode:string}>(teacherToken,'/health');assert.equal(health.status,'ok');assert.equal(health.aiMode,'gemini');
  assert.equal((await request<{role:string}>(teacherToken,'/auth/session')).role,'teacher');assert.equal((await request<{role:string}>(adminToken,'/auth/session')).role,'admin');
  const usageBefore=await usage();
  const seeded=manifest.accounts.filter(a=>a.role==='student');
  const rosterBefore=await rosterFor(teacherToken);
  for(const account of seeded)assert(rosterBefore.students.some(s=>s.id===account.actorId&&s.teacherId===teacherAccount.actorId),'Seeded learner missing from teacher roster');
  const bank=await questions();
  const draft=bank.questions.find(q=>q.status==='draft'&&q.createdBy===teacherAccount.actorId);
  assert(draft,'Expected an existing teacher draft');
  await request(teacherToken,`/ai/questions/${draft.id}/approve`,'POST',{note:'Permission verification only',checkedGrammarAndAnswer:true},403);
  await request(teacherToken,`/ai/questions/${draft.id}/reject`,'POST',{note:'Permission verification only'},403);
  await request(teacherToken,'/research/export','GET',undefined,403);
  assert.equal((await request<{error:string}>(adminToken,`/ai/questions/${draft.id}/approve`,'POST',{note:'Permission verification only'},400)).error,'REVIEW_ATTESTATION_REQUIRED');
  const question=bank.questions.find(q=>q.status==='approved'&&q.questionType==='multiple_choice'&&q.provenance==='gemini');
  assert(question,'A previously approved real Gemini multiple-choice question is required');
  const account=await request<{id:string;token:string}>(teacherToken,'/learning/students','POST',{mode:'adaptive',experimentGroup:'local_role_verification'},201);temporaryStudent=account.id;
  const roster=await rosterFor(teacherToken);assert(roster.students.some(s=>s.id===account.id&&s.total===0));
  const studentToken=account.token;
  const next=await request<Assignment>(studentToken,`/learning/students/${account.id}/next-question?questionType=multiple_choice&tense=${question.tense}`);
  assert(next.question);const answer=bank.questions.find(q=>q.id===next.question!.id)!.correctAnswer;
  const result=await request<Feedback>(studentToken,'/learning/attempts','POST',{decisionId:next.decisionId,answer});assert.equal(result.correct,true);
  assert.equal(result.gradingSource,'stored_option_key');
  const progress=(await rosterFor(teacherToken)).students.find(s=>s.id===account.id)!;
  assert.equal(progress.total,1);assert.equal(progress.confirmed,1);assert.equal(progress.correct,1);
  const report=await reportFor(teacherToken);assert(report.rows.some(r=>r.anonymousStudentId===account.id&&r.correct===true));
  const assignedIds=new Set((await rosterFor(teacherToken)).students.map(s=>s.id));
  assert(report.rows.every(r=>assignedIds.has(r.anonymousStudentId)));
  await request(studentToken,'/learning/students','GET',undefined,403);
  await request(adminToken,`/learning/students/${account.id}/teacher`,'PATCH',{teacherId:null});
  assert(!(await rosterFor(teacherToken)).students.some(s=>s.id===account.id));
  assert(!(await reportFor(teacherToken)).rows.some(r=>r.anonymousStudentId===account.id));
  assert((await reportFor(adminToken)).rows.some(r=>r.anonymousStudentId===account.id));
  assert.equal((await questions()).questions.find(q=>q.id===draft.id)!.status,'draft');
  const usageAfter=await usage();
  assert.equal(usageAfter.totals._count,usageBefore.totals._count);
  const evidence={checkedAt:new Date().toISOString(),origin,aiMode:health.aiMode,seededStudentsAssigned:seeded.length,teacherPublicationStatus:403,teacherGlobalResearchStatus:403,adminReviewAttestationStatus:400,realApprovedQuestion:next.question.id,realGradingSource:result.gradingSource,realAnswerCorrect:result.correct,teacherScopedReport:true,adminReassignment:true,newAiCalls:0,temporaryLearnerRemoved:true};
  await request(adminToken,`/learning/students/${account.id}`,'DELETE',undefined,204);temporaryStudent=undefined;
  await writeFile('.tmp/role-verification.json',JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
} finally {
  if(temporaryStudent)await request(adminToken,`/learning/students/${temporaryStudent}`,'DELETE',undefined,204);
}
