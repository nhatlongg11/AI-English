import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {loadConfig} from '../src/config.js';
import {createDb} from '../src/db.js';
import type {StudyPlanResult,ExplanationResult,LessonPlanResult,InsightsResult} from '../frontend/src/types-ai.js';

if(process.env.RUN_LIVE_GEMINI!=='true'){
  console.log('SKIPPED: set RUN_LIVE_GEMINI=true to verify the AI support features with paid Gemini calls.');
}else{
  const config=loadConfig();assert(!config.AI_MOCK_MODE,'Live verification requires AI_MOCK_MODE=false');
  assert(process.env.NODE_ENV!=='production'&&['127.0.0.1','localhost','::1'].includes(config.HOST),'Local verification only');
  const manifest=JSON.parse(await readFile('.tmp/local-accounts.json','utf8')) as {accounts:{role:string;actorId:string;token:string}[]};
  const teacher=manifest.accounts.find(a=>a.role==='teacher')!,student=manifest.accounts.find(a=>a.role==='student')!;assert(teacher&&student);
  const db=createDb(config.DATABASE_URL);const base='http://127.0.0.1:5173';const started=new Date();
  async function request<T>(path:string,token:string,body:object):Promise<T>{
    const r=await fetch(`${base}/api/v1${path}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
    const data=await r.json();assert.equal(r.status,200,`${path}: HTTP ${r.status}, ${data.error??'unknown'}`);assert.equal(data.provenance,'gemini');return data as T;
  }
  try{
    for(const path of ['/student/ai-coach','/teacher/ai-tools'])assert.equal((await fetch(base+path)).status,200);
    const before={attempts:await db.attempt.count(),questions:await db.question.count(),exercises:await db.exercise.count()};
    const answer=await db.attempt.findFirst({where:{studentId:student.actorId},orderBy:{createdAt:'desc'}});assert(answer,'Submit a student answer before verifying explanations');
    console.log('Checking the personal study plan with real saved progress…');
    const plan=await request<StudyPlanResult>('/ai/study-plan',student.token,{days:3,minutesPerDay:10});assert.equal(plan.data.days.length,3);
    assert.equal(plan.context.statistics.availableAttempts,await db.attempt.count({where:{studentId:student.actorId}}));
    console.log('Checking an explanation for an existing submitted answer…');
    const explanation=await request<ExplanationResult>('/ai/answer-explanation',student.token,{attemptId:answer.id});assert(explanation.data.stepsVi.length>=2);
    assert.equal((await db.attempt.findUniqueOrThrow({where:{id:answer.id}})).correct,answer.correct);
    console.log('Checking a 30-minute lesson plan…');
    const lesson=await request<LessonPlanResult>('/ai/lesson-plan',teacher.token,{tense:'present_simple',difficulty:1,minutes:30,focusError:null});assert.equal(lesson.data.activities.reduce((n,a)=>n+a.minutes,0),30);
    console.log('Checking teacher suggestions against their own students’ results…');
    const insights=await request<InsightsResult>('/ai/class-insights',teacher.token,{});assert(insights.context.statistics.confirmed>0);
    const scopedCount=await db.attempt.count({where:{student:{teacherId:teacher.actorId}}});assert.equal(insights.context.statistics.availableAttempts,scopedCount);
    const usageCount=await db.aiUsage.count();
    const repeated=await request<StudyPlanResult>('/ai/study-plan',student.token,{days:3,minutesPerDay:10});assert(repeated.cached);assert.equal(await db.aiUsage.count(),usageCount);
    assert.deepEqual({attempts:await db.attempt.count(),questions:await db.question.count(),exercises:await db.exercise.count()},before);
    const usage=await db.aiUsage.findMany({where:{createdAt:{gte:started}},select:{operation:true,model:true,status:true,provenance:true,estimatedCostUsd:true}});
    const evidence={checkedAt:new Date().toISOString(),mode:'LIVE_GEMINI',features:{studyPlanDays:plan.data.days.length,explanationSteps:explanation.data.stepsVi.length,lessonMinutes:30,teachingPriorities:insights.data.priorities.length},savedStudentAttempts:plan.context.statistics.availableAttempts,teacherScopedAttempts:scopedCount,cacheAvoidedRepeatCall:true,gradesAndQuestionBankUnchanged:true,newProviderCalls:usage.length,estimatedCostUsd:usage.reduce((n,u)=>n+u.estimatedCostUsd,0),usage};
    await writeFile('.tmp/ai-support-verification.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
  }finally{await db.$disconnect();}
}
