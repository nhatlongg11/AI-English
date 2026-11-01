import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {loadConfig} from '../src/config.js';
import {createDb} from '../src/db.js';
import type {BankQuestion,ExerciseNext,LessonDetail} from '../frontend/src/types.js';

const config=loadConfig();
if(process.env.NODE_ENV==='production'||!['127.0.0.1','localhost','::1'].includes(config.HOST))throw new Error('Classroom verification is for the local app only');
const {accounts}=JSON.parse(await readFile('.tmp/local-accounts.json','utf8')) as {accounts:{role:string;token:string}[]};
const teacher=accounts.find(a=>a.role==='teacher')!,admin=accounts.find(a=>a.role==='admin')!;assert(teacher&&admin);
const db=createDb(config.DATABASE_URL);const base='http://127.0.0.1:5173';
let studentId:string|undefined,lessonId:string|undefined,exerciseId:string|undefined;
async function request<T>(path:string,token:string,method='GET',body?:object,expected=200):Promise<T>{
  const response=await fetch(`${base}/api/v1${path}`,{method,headers:{authorization:`Bearer ${token}`,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  const data=response.status===204?null:await response.json();assert.equal(response.status,expected,`${path}: ${response.status} ${data?.error??''}`);return data as T;
}
try{
  for(const path of ['/teacher/attendance','/teacher/exercises','/student/exercises'])assert.equal((await fetch(base+path)).status,200);
  const usage=await db.aiUsage.count();
  const bank=await request<{questions:BankQuestion[]}>('/ai/questions?limit=100&status=approved',teacher.token);
  const q=bank.questions.find(q=>q.provenance==='gemini'&&q.questionType==='multiple_choice');assert(q,'Need an existing approved Gemini question');
  const student=await request<{id:string;token:string}>('/learning/students',teacher.token,'POST',{mode:'adaptive',experimentGroup:'local_classroom_verification',displayName:'Classroom QA — temporary'},201);studentId=student.id;
  const heldOn=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const lesson=await request<{lesson:{id:string}}>('/teaching/lessons',teacher.token,'POST',{title:'Temporary classroom verification',heldOn,studentIds:[student.id]},201);lessonId=lesson.lesson.id;
  assert.equal((await request<{lesson:LessonDetail}>(`/teaching/lessons/${lessonId}`,teacher.token)).lesson.records[0]!.status,'unmarked');
  await request(`/teaching/lessons/${lessonId}/attendance`,teacher.token,'PATCH',{records:[{studentId:student.id,status:'present'}]});
  assert.equal((await db.attendanceRecord.findUniqueOrThrow({where:{lessonId_studentId:{lessonId,studentId:student.id}}})).status,'present');
  await request('/teaching/lessons',student.token,'GET',undefined,403);
  const exercise=await request<{exercise:{id:string}}>('/teaching/exercises',teacher.token,'POST',{title:'Temporary classroom verification',instructions:'Answer the approved question.',questionIds:[q.id],studentIds:[student.id]},201);exerciseId=exercise.exercise.id;
  assert.equal((await request<{exercises:unknown[]}>('/learning/exercises',student.token)).exercises.length,0);
  await request(`/teaching/exercises/${exerciseId}/publish`,teacher.token,'POST');
  const next=await request<ExerciseNext>(`/learning/exercises/${exerciseId}/next-question`,student.token);assert(next.question);assert.equal(next.question.id,q.id);assert(!('correctAnswer' in next.question));
  assert.equal((await request<ExerciseNext>(`/learning/exercises/${exerciseId}/next-question`,student.token)).decisionId,next.decisionId);
  const result=await request<{correct:boolean;gradingSource:string}>('/learning/attempts',student.token,'POST',{decisionId:next.decisionId,answer:q.correctAnswer});assert.equal(result.correct,true);assert.equal(result.gradingSource,'stored_option_key');
  assert.equal((await request<ExerciseNext>(`/learning/exercises/${exerciseId}/next-question`,student.token)).completed,true);
  const detail=await request<{exercise:{recipients:{answered:number;correct:number}[]}}>(`/teaching/exercises/${exerciseId}`,teacher.token);assert.equal(detail.exercise.recipients[0]!.answered,1);assert.equal(detail.exercise.recipients[0]!.correct,1);
  const attempt=await db.attempt.findFirstOrThrow({where:{studentId:student.id},include:{decision:true}});assert.equal(attempt.decision.exerciseId,exerciseId);
  assert.equal(await db.aiUsage.count(),usage);
  const evidence={checkedAt:new Date().toISOString(),frontend:'Vite',backend:'Fastify',database:'existing SQLite',attendanceSaved:true,exerciseAssigned:true,questionProvenance:q.provenance,questionId:q.id,answerCorrect:result.correct,resumeStable:true,completionPersisted:true,teacherProgressVerified:true,newAiCalls:0,temporaryDataRemoved:true};
  await db.exercise.delete({where:{id:exerciseId}});exerciseId=undefined;
  await db.attendanceLesson.delete({where:{id:lessonId}});lessonId=undefined;
  await request(`/learning/students/${student.id}`,admin.token,'DELETE',undefined,204);studentId=undefined;
  await writeFile('.tmp/classroom-verification.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}finally{
  if(exerciseId)await db.exercise.deleteMany({where:{id:exerciseId}});
  if(lessonId)await db.attendanceLesson.deleteMany({where:{id:lessonId}});
  if(studentId)await db.student.deleteMany({where:{id:studentId}});
  await db.$disconnect();
}
