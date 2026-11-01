import type { Attempt, MasterySnapshot, Question } from '@prisma/client';
import { tenses, type GenerateRequest } from './domain.js';

export const ALGORITHM_VERSION = 'weighted-window-v1';
export function scoreSkill(attempts:Pick<Attempt,'correct'|'errorCode'|'createdAt'>[],currentDifficulty=1) {
  const recent = attempts.filter(a=>a.correct!==null).slice(-10);
  const weight = recent.reduce((sum,_,i) => sum+i+1,0);
  const mastery = recent.length ? recent.reduce((sum,a,i) => sum+(a.correct?i+1:0),0)/weight : 0.5;
  const last = recent.slice(-3);
  const difficulty = last.length === 3 && last.every(a => a.correct) ? Math.min(5,currentDifficulty+1)
    : last.length >= 2 && last.slice(-2).every(a => !a.correct) ? Math.max(1,currentDifficulty-1) : currentDifficulty;
  return {mastery,recentAccuracy:recent.length?recent.filter(a=>a.correct).length/recent.length:0,
    recentErrors:recent.filter(a=>!a.correct && a.errorCode).length,difficulty};
}

export function chooseQuestion(questions:Question[], snapshots:MasterySnapshot[], attempts:Attempt[],mode:string, now=new Date()) {
  const ordered = [...questions].sort((a,b)=>a.id.localeCompare(b.id));
  const previous = attempts.at(-1)?.questionId;
  const unpracticed = (pool:Question[]) => pool.filter(q=>!attempts.some(a=>a.questionId===q.id));
  if (mode === 'baseline') {
    // Fixed progression: three tenses at each level, four completed items per step.
    const step = Math.floor(attempts.length/4) % 15;
    const tense = tenses[step%3]!;
    const difficulty = Math.floor(step/3)+1;
    const pool = ordered.filter(q=>q.tense===tense && q.difficulty===difficulty);
    const q = unpracticed(pool)[0] ?? pool.find(q=>q.id!==previous) ?? pool[0];
    const fallback = ordered.find(q=>q.tense===tense && q.id!==previous) ?? ordered[0];
    return {question:q??fallback,needsContent:!q,reason:{mode,step,tense,difficulty,fallback:!q,rule:'fixed_four_attempts_per_step'},
      request:{tense,difficulty,questionType:'multiple_choice',count:3,modelTier:'primary'} satisfies GenerateRequest};
  }
  const review = attempts.length>0 && attempts.length%5===0;
  const snapshot = new Map(snapshots.map(s=>[s.skillId,s]));
  const priorities = [...new Set([...ordered.map(q=>q.skillId),...snapshots.map(s=>s.skillId)])].map(skillId=>{
    const s = snapshot.get(skillId);
    const days = s ? Math.min(30,Math.max(0,(now.getTime()-s.lastPracticedAt.getTime())/86400000)) : 30;
    return {skillId,s,priority:review && s && s.mastery>=0.8 ? 10+days/30 : (1-(s?.mastery??0.5))*2+(s?.recentErrors??0)*0.2+days/300};
  }).sort((a,b)=>b.priority-a.priority || a.skillId.localeCompare(b.skillId));
  const target = priorities[0];
  const skillId = target?.skillId ?? 'present_simple:E01';
  const [tense,errorCode] = skillId.split(':') as [GenerateRequest['tense'],NonNullable<GenerateRequest['targetErrorCode']>];
  const difficulty = target?.s?.difficulty ?? 1;
  const exact = ordered.filter(q=>q.skillId===skillId && q.difficulty===difficulty);
  const q = unpracticed(exact)[0] ?? exact.find(q=>q.id!==previous) ?? exact[0];
  const fallback = ordered.filter(q=>q.skillId===skillId && q.id!==previous).sort((a,b)=>Math.abs(a.difficulty-difficulty)-Math.abs(b.difficulty-difficulty) || a.id.localeCompare(b.id))[0]
    ?? ordered.find(q=>q.id!==previous) ?? ordered[0];
  return {question:q??fallback,needsContent:!q,reason:{mode,review,skillId,difficulty,fallback:!q,priority:target?.priority??null,
    mastery:target?.s?.mastery??0.5,recentErrors:target?.s?.recentErrors??0,rule:'weakness_repeated_errors_spaced_review'},
    request:{tense,difficulty,questionType:'multiple_choice',count:3,targetErrorCode:errorCode,modelTier:'primary'} satisfies GenerateRequest};
}
