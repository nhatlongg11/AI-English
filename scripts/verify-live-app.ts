import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db.js';
import { hash, type QuestionInput } from '../src/domain.js';

// Exercises the actual Vite proxy, Fastify routes, Gemini diagnosis and persistent SQLite.
// Use only reviewed live questions. This script never approves teaching content.
if (process.env.RUN_LIVE_GEMINI !== 'true') {
  console.log('SKIPPED: set RUN_LIVE_GEMINI=true; this creates labelled local QA data and can incur Gemini charges.');
} else {
  const config = loadConfig();
  assert.equal(config.AI_MOCK_MODE, false, 'Set AI_MOCK_MODE=false before testing the live app');
  const credentials = JSON.parse(config.AUTH_CREDENTIALS_JSON) as { role: string; token: string }[];
  const admin = credentials.find(c => c.role === 'admin');
  const teacher = credentials.find(c => c.role === 'teacher');
  assert.ok(admin && teacher, 'Local admin and teacher credentials are required');
  const base = 'http://127.0.0.1:5173';
  const db = createDb(config.DATABASE_URL);
  const started = new Date();
  const checks: string[] = [];
  async function request<T>(path: string, token = '', body?: unknown, expected = 200): Promise<T> {
    const options: RequestInit = {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    };
    let response = await fetch(`${base}/api/v1${path}`, {...options,signal:AbortSignal.timeout(config.AI_TIMEOUT_MS * (config.AI_MAX_RETRIES + 1) + 10000)});
    let data = await response.json();
    // The HTTP limiter runs before a handler. Respect it without raising classroom limits.
    if(response.status === 429 && data.error === 'RATE_LIMITED') {
      const seconds=Math.min(60,Math.max(1,Number(response.headers.get('retry-after'))||60));
      console.log(`Local API rate limit active; waiting ${seconds}s before one retry.`);
      await delay(seconds*1000+250);
      response=await fetch(`${base}/api/v1${path}`,{...options,signal:AbortSignal.timeout(config.AI_TIMEOUT_MS * (config.AI_MAX_RETRIES + 1) + 10000)});
      data=await response.json();
    }
    assert.equal(response.status, expected, `${path}: HTTP ${response.status}, code ${(data as {error?: string}).error ?? 'none'}`);
    return data as T;
  }
  try {
    assert.equal((await fetch(`${base}/student/dashboard`)).status, 200);
    const health = await request<{aiMode:string}>('/health');
    assert.equal(health.aiMode, 'gemini');
    await request('/auth/session', '', undefined, 401);
    assert.equal((await request<{role:string}>('/auth/session', teacher.token)).role, 'teacher');
    checks.push('Frontend HTTP, API proxy, live mode and authentication');

    const bank = await request<{questions:(QuestionInput & {id:string;provenance:string;model:string;status:string})[]}>('/ai/questions?status=approved&limit=100', teacher.token);
    const types = ['multiple_choice', 'fill_in_blank', 'error_correction'] as const;
    const questions = types.map(type => {
      const question = bank.questions.find(q => q.provenance === 'gemini' && q.questionType === type && q.tense === 'present_simple' && q.difficulty === 1);
      assert.ok(question, `Review one live present_simple, difficulty 1 ${type} question before testing`);
      return question;
    });
    for (const q of questions) {
      const saved = await db.question.findUniqueOrThrow({where:{id:q.id}});
      assert.equal(saved.content, q.content);
      assert.equal(saved.correctAnswer, q.correctAnswer);
      assert.equal(saved.provenance, 'gemini');
      assert.ok(await db.aiUsage.findFirst({where:{provenance:'gemini',operation:'generate',status:'success',model:q.model}}));
    }
    checks.push('All three question types match persistent live bank records and successful generation usage');
    const group = `local_qa_${randomUUID().slice(0,8)}`;
    const student = await request<{id:string;token:string}>('/learning/students', admin.token, {mode:'adaptive',experimentGroup:group}, 201);
    await mkdir('.tmp', {recursive:true});
    // Ignored server-side file: never put credentials in a URL, report or frontend bundle.
    await writeFile('.tmp/live-qa-access.json', JSON.stringify({student,experimentGroup:group,notice:'Local QA account; answers are test inputs, not classroom research evidence.'},null,2), {mode:0o600});
    assert.equal((await request<{actorId:string}>('/auth/session', student.token)).actorId, student.id);
    await request('/research/export', student.token, undefined, 403);
    const empty = await request<{total:number}>(`/learning/students/${student.id}/summary`, student.token);
    assert.equal(empty.total, 0);

    const attemptIds: string[] = [];
    type Feedback = {attemptId:string;correct:boolean|null;gradingSource:string;requiresTeacherReview:boolean;diagnosis:{provenance:string;source:string}};
    async function answer(index:number, wrong=false) {
      const q = questions[index]!;
      const assignment = await request<{decisionId:string;question:{id:string;provenance:string;correctAnswer?:string;wordTokens?:{id:string;text:string}[]}}>(`/learning/students/${student.id}/next-question?tense=present_simple&questionType=${q.questionType}`,student.token);
      assert.equal(assignment.question.id, q.id);
      assert.equal(assignment.question.provenance, 'gemini');
      assert.equal(assignment.question.correctAnswer, undefined);
      let payload: {answer:string}|{tokenIds:string[]};
      if (q.questionType === 'error_correction' && !wrong) {
        const remaining = [...assignment.question.wordTokens!];
        const tokenIds = q.correctAnswer.trim().split(/\s+/).map(word => {
          const position = remaining.findIndex(t => t.text === word);
          assert.ok(position >= 0);
          return remaining.splice(position,1)[0]!.id;
        });
        payload = {tokenIds};
      } else {
        const text = wrong
          ? q.questionType === 'multiple_choice' ? q.options.find(o => o.text !== q.correctAnswer)!.text : q.questionType === 'fill_in_blank' ? `${q.correctAnswer}ing` : q.content.replace(/^Correct (?:this|the) sentence:\s*/i,'')
          : q.correctAnswer;
        assert.ok(!wrong || text !== q.correctAnswer, 'Wrong-answer QA input must differ from key');
        payload = {answer:text};
      }
      const feedback = await request<Feedback>('/learning/attempts',student.token,{decisionId:assignment.decisionId,...payload});
      assert.equal(feedback.correct, wrong ? q.questionType === 'multiple_choice' ? false : null : true);
      const saved = await db.attempt.findUniqueOrThrow({where:{id:feedback.attemptId}});
      assert.equal(saved.correct, feedback.correct);
      assert.equal(saved.studentId,student.id);
      attemptIds.push(saved.id);
      if (wrong && q.questionType !== 'multiple_choice') {
        assert.equal(feedback.diagnosis.provenance, 'gemini', 'Live diagnosis must succeed; fallback is not a live pass');
        assert.equal(feedback.requiresTeacherReview, true);
        assert.equal(saved.gradingSource,'pending_teacher_review');
      }
      const recovered = await request<Feedback>(`/learning/assignments/${assignment.decisionId}/result`,student.token);
      assert.equal(recovered.attemptId,saved.id);
      if (attemptIds.length===1) await request('/learning/attempts',student.token,{decisionId:assignment.decisionId,...payload},409);
    }
    await answer(0);
    await answer(0,true);
    await answer(1);
    await answer(2);
    const beforePending = await db.masterySnapshot.findMany({where:{studentId:student.id}});
    await answer(1,true);
    await answer(2,true);
    assert.deepEqual(await db.masterySnapshot.findMany({where:{studentId:student.id}}),beforePending);
    checks.push('MC correct/incorrect, fill-in, word-token submission, live free-text diagnosis, duplicate prevention and recovery');
    checks.push('Two pending free-text answers do not change confirmed mastery');

    const summary = await request<{total:number;confirmed:number;correct:number;xp:number;attempts:{id:string;correct:boolean|null}[]}>(`/learning/students/${student.id}/summary`,student.token);
    assert.equal(summary.total,6);assert.equal(summary.confirmed,4);assert.equal(summary.correct,3);assert.equal(summary.xp,30);
    assert.equal(summary.attempts.filter(a=>a.correct===null).length,2);
    const rows = await request<{rows:{attemptId:string;correct:boolean|null;provenance:string;experimentGroup:string;answerHash:string}[]}>('/research/export?limit=1000',admin.token);
    const ownRows=rows.rows.filter(r=>attemptIds.includes(r.attemptId));
    assert.equal(ownRows.length,6);
    for(const row of ownRows){
      const attempt=await db.attempt.findUniqueOrThrow({where:{id:row.attemptId}});
      assert.equal(row.correct,attempt.correct);assert.equal(row.answerHash,hash(attempt.answer));
      assert.equal(row.provenance,'gemini');assert.equal(row.experimentGroup,group);
    }
    const usage=await db.aiUsage.findMany({where:{createdAt:{gte:started}}});
    assert.equal(usage.filter(u=>u.provenance==='mock').length,0);
    assert.equal(usage.filter(u=>u.operation==='diagnose'&&u.status==='success'&&u.provenance==='gemini').length,2);
    checks.push('Dashboard: 6 attempts, 4 confirmed, 3 correct, 75% accuracy, 30 XP; research export matches SQLite');
    const report={status:'LIVE_APP_VERIFIED',verifiedAt:new Date().toISOString(),frontend:base,aiMode:health.aiMode,
      experimentGroup:group,studentId:student.id,notice:'Real Gemini and database operations with QA answer inputs; not measured classroom outcomes.',
      questionIds:questions.map(q=>q.id),attemptIds,summary:{total:6,confirmed:4,correct:3,pending:2,accuracy:0.75,xp:30},
      checks,diagnosisUsage:usage.map(u=>({model:u.model,status:u.status,inputTokens:u.inputTokens,outputTokens:u.outputTokens,estimatedCostUsd:u.estimatedCostUsd,usageEstimated:u.usageEstimated}))};
    await writeFile('.tmp/live-app-verification.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
    console.log('QA student access saved locally in .tmp/live-qa-access.json; credentials omitted from this report.');
  } finally { await db.$disconnect(); }
}
