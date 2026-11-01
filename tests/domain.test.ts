import { describe, it, expect } from 'vitest';
import { grammarExamples, mockQuestions } from '../src/fixtures.js';
import { generateSchema, validateBatch, diagnosisSchema } from '../src/domain.js';
import { scoreSkill, chooseQuestion } from '../src/adaptive.js';
import type { Question, Attempt, MasterySnapshot } from '@prisma/client';

const request=generateSchema.parse({tense:'present_simple',difficulty:1,questionType:'multiple_choice',count:1});
const q=grammarExamples[0]!;
describe('30 author-written representative grammar examples (not a research dataset)',()=>{
  it.each(grammarExamples.map((example,index)=>({example,index})))('example $index: $example.content',({example})=>{
    const req={...request,tense:example.tense};
    expect(validateBatch({questions:[example]},req)[0]?.correctAnswer).toBe(example.correctAnswer);
  });
});
describe('schema and deterministic validation',()=>{
  it.each([{tense:'future_perfect'},{questionType:'essay'},{count:0},{count:11},{difficulty:6},{targetErrorCode:'E99'}])('rejects invalid scope %j',invalid=>{
    expect(()=>generateSchema.parse({...request,...invalid})).toThrow();
  });
  it('rejects answer missing from options',()=>expect(()=>validateBatch({questions:[{...q,correctAnswer:'goes'}]},request)).toThrow());
  it('rejects case-insensitive duplicate options',()=>expect(()=>validateBatch({questions:[{...q,options:[{text:'walks',errorCode:null},{text:'WALKS',errorCode:'E01'},{text:'walking',errorCode:'E01'}]}]},request)).toThrow());
  it('rejects an error mapping on the correct answer',()=>expect(()=>validateBatch({questions:[{...q,options:q.options.map(o=>({...o,errorCode:'E01'}))}]},request)).toThrow());
  it('rejects duplicate questions and incorrect count',()=>{
    expect(()=>validateBatch({questions:[q,q]},{...request,count:2})).toThrow();
    expect(()=>validateBatch({questions:[q]},{...request,count:2})).toThrow();
  });
  it('rejects incorrect tense, difficulty, type and target',()=>{
    for (const changed of [{tense:'past_simple'},{difficulty:2},{questionType:'error_correction'},{errorCode:'E02'}]) {
      expect(()=>validateBatch({questions:[{...q,...changed}]},{...request,targetErrorCode:'E01'})).toThrow();
    }
  });
  it('rejects missing fields and unsupported error codes',()=>{
    expect(()=>validateBatch({questions:[{...q,grammarRule:''}]},request)).toThrow();
    expect(()=>validateBatch({questions:[{...q,errorCode:'E99'}]},request)).toThrow();
  });
  it('requires a single fill-in blank and no options',()=>{
    const req={...request,questionType:'fill_in_blank' as const};
    expect(()=>validateBatch({questions:[{...q,questionType:'fill_in_blank',options:[],content:'A sentence without a blank.'}]},req)).toThrow();
    expect(validateBatch(mockQuestions(req),req)).toHaveLength(1);
  });
  it('rejects unconstrained fill-in questions with multiple possible verbs',()=>{
    const req={...request,questionType:'fill_in_blank' as const};
    expect(()=>validateBatch({questions:[{...q,questionType:'fill_in_blank',options:[]}]},req)).toThrow('verb cue');
    expect(validateBatch({questions:[{...q,questionType:'fill_in_blank',options:[],content:'Every morning, Lan ____ (walk) to school.'}]},req)).toHaveLength(1);
  });
  it.each(['present_simple','past_simple','present_continuous'] as const)('keeps all authored %s fill-in examples constrained',tense=>{
    const req={...request,tense,questionType:'fill_in_blank' as const,count:10};
    expect(validateBatch(mockQuestions(req),req)).toHaveLength(10);
  });
  it('accepts uncertainty without forced classification',()=>{
    expect(()=>diagnosisSchema.parse({status:'uncertain',correctedSentence:null,errorCodes:['E01'],explanationVi:'Chưa chắc chắn.'})).toThrow();
  });
});
describe('interpretable adaptation',()=>{
  const attempts=(values:(boolean|null)[])=>values.map((correct,i)=>({correct,errorCode:correct?'': 'E01',createdAt:new Date(i)}));
  it('weights recent performance and counts errors',()=>{
    const score=scoreSkill(attempts([false,false,true]));
    expect(score.mastery).toBe(0.5);expect(score.recentErrors).toBe(2);
  });
  it('raises difficulty after three successes and lowers after two failures',()=>{
    expect(scoreSkill(attempts([true,true,true]),2).difficulty).toBe(3);
    expect(scoreSkill(attempts([false,false]),2).difficulty).toBe(1);
    expect(scoreSkill(attempts([true,true,true]),5).difficulty).toBe(5);
  });
  it('does not punish uncertain free text',()=>expect(scoreSkill(attempts([true,null])).mastery).toBe(1));
  const questions=[{...q,id:'q1',skillId:'present_simple:E01'}, {...q,id:'q2',skillId:'present_simple:E02',errorCode:'E02'}] as unknown as Question[];
  const snapshots=[{skillId:'present_simple:E01',mastery:0.2,recentErrors:3,difficulty:1,lastPracticedAt:new Date('2026-10-01')} ] as MasterySnapshot[];
  it('prioritizes repeated E01 errors reproducibly',()=>{
    const result=chooseQuestion(questions,snapshots,[],'adaptive',new Date('2026-10-21'));
    expect(result.question?.id).toBe('q1');expect(result.reason).toMatchObject({skillId:'present_simple:E01'});
  });
  it('uses fixed baseline progression and reports missing target content',()=>{
    expect(chooseQuestion(questions,snapshots,[],'baseline').question?.id).toBe('q1');
    const result=chooseQuestion(questions,snapshots,Array(4).fill({questionId:'q1'}) as Attempt[],'baseline');
    expect(result.request.tense).toBe('present_continuous');expect(result.needsContent).toBe(true);expect(result.question).toBeDefined();
  });
  it('occasionally reviews mastered skills',()=>{
    const review=chooseQuestion(questions,[{...snapshots[0],mastery:0.9,recentErrors:0} as MasterySnapshot],Array(5).fill({questionId:'q2'}) as Attempt[],'adaptive',new Date('2026-10-21'));
    expect(review.reason).toMatchObject({review:true,skillId:'present_simple:E01'});
  });
});
