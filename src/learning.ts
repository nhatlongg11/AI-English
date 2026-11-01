import type { PrismaClient } from '@prisma/client';
import { AppError } from './config.js';
import { normalize } from './domain.js';
import { DiagnosisService, safeDiagnosis } from './diagnosis.js';
import { ALGORITHM_VERSION, chooseQuestion, scoreSkill } from './adaptive.js';
import { publicQuestion, questionInclude } from './questions.js';
import { sentenceTokens } from './sentence-tokens.js';

export interface PracticeScope {tense?:string;questionType?:string}

export class LearningService {
  constructor(private db:PrismaClient,private diagnosis:DiagnosisService) {}
  async next(studentId:string,scope:PracticeScope={}) {
    return this.db.$transaction(async db=>{
    const student = await db.student.findUniqueOrThrow({where:{id:studentId}});
    // Repeated GETs return the existing unanswered assignment, preserving the study sequence.
    const scoped = Boolean(scope.tense || scope.questionType);
    const pending = await db.selectionDecision.findFirst({where:{studentId,exerciseId:null,questionId:{not:null},attempt:null,
      ...(scoped?{question:{tense:scope.tense,questionType:scope.questionType}}:{})},
      orderBy:{createdAt:'asc'},include:{question:{include:questionInclude}}});
    if (pending?.question?.status === 'approved') return {decisionId:pending.id,question:publicQuestion(pending.question),reason:JSON.parse(pending.reason),
      generationNeeded:pending.generationRequest?{request:JSON.parse(pending.generationRequest),status:'awaiting_authorized_generation_and_teacher_review'}:null};
    const [questions,snapshots,attempts] = await Promise.all([
      db.question.findMany({where:{status:'approved',tense:scope.tense,questionType:scope.questionType},include:questionInclude,orderBy:{id:'asc'}}),
      db.masterySnapshot.findMany({where:{studentId,tense:scope.tense}}),
      db.attempt.findMany({where:{studentId},orderBy:[{createdAt:'asc'},{id:'asc'}]}),
    ]);
    const selection = chooseQuestion(questions,snapshots,attempts,student.mode);
    if (scope.tense) selection.request.tense=scope.tense as typeof selection.request.tense;
    if (scope.questionType) selection.request.questionType=scope.questionType as typeof selection.request.questionType;
    const reason={...selection.reason,...(scoped?{scope,practiceContext:'student_selected_practice'}:{practiceContext:'assigned_progression'})};
    const decision = await db.selectionDecision.create({data:{studentId,questionId:selection.question?.id,
      mode:student.mode,algorithm:ALGORITHM_VERSION,reason:JSON.stringify(reason),
      generationRequest:selection.needsContent?JSON.stringify(selection.request):null}});
    return {decisionId:decision.id,question:selection.question?publicQuestion(selection.question as typeof questions[number]):null,
      reason,generationNeeded:selection.needsContent?{request:selection.request,status:'awaiting_authorized_generation_and_teacher_review'}:null};
    });
  }
  async submit(studentId:string,decisionId:string,answer:string,tokenIds?:string[]) {
    const decision = await this.db.selectionDecision.findUnique({where:{id:decisionId},include:{question:{include:questionInclude},attempt:true}});
    if (!decision || decision.studentId !== studentId || !decision.question) throw new AppError(404,'NOT_FOUND','Assigned question not found');
    if(decision.exerciseId&&!await this.db.exerciseRecipient.findFirst({where:{exerciseId:decision.exerciseId,studentId,exercise:{publishedAt:{not:null}}}}))throw new AppError(404,'NOT_FOUND','Assigned exercise not found');
    if (decision.attempt) throw new AppError(409,'ALREADY_SUBMITTED','This assignment has already been submitted');
    const q = decision.question;
    if (q.status !== 'approved') throw new AppError(409,'QUESTION_NOT_APPROVED','Question is not approved');
    if (tokenIds) {
      if (q.questionType!=='error_correction') throw new AppError(400,'INVALID_TOKENS','Sentence tokens require an error-correction assignment');
      const tokens=sentenceTokens(q.id,q.correctAnswer);
      const map=new Map(tokens.map(t=>[t.id,t.text]));
      if(tokenIds.length!==tokens.length || new Set(tokenIds).size!==tokens.length || tokenIds.some(id=>!map.has(id)))
        throw new AppError(400,'INVALID_TOKENS','Submit every assigned word exactly once');
      answer=tokenIds.map(id=>map.get(id)!).join(' ');
    }
    const option = q.options.find(o=>normalize(o.text)===normalize(answer));
    if (q.questionType==='multiple_choice' && !option) throw new AppError(400,'INVALID_OPTION','Choose one of the supplied options');
    const matchesKey = normalize(answer)===normalize(q.correctAnswer);
    const correct = q.questionType==='multiple_choice' || matchesKey ? matchesKey : null;
    const diagnostic = q.questionType==='multiple_choice' || matchesKey
      ? {...safeDiagnosis,status:matchesKey?'unclassified':option?.errorCode?'classified':'unclassified',
        correctedSentence:q.correctAnswer,errorCodes:!correct && option?.errorCode?[option.errorCode]:[],
        explanationVi:q.explanationVi,source:'answer_key',provenance:'teacher_approved'}
      : await this.diagnosis.diagnose({content:q.content,tense:q.tense,answer,correctAnswer:q.correctAnswer});
    // Uncertain AI errors cannot be promoted to a definitive error classification.
    const errorCode = correct === false && diagnostic.status==='classified' ? diagnostic.errorCodes[0] ?? null : null;
    try {
      return await this.db.$transaction(async tx => {
        const attempt = await tx.attempt.create({data:{studentId,questionId:q.id,decisionId,answer,correct,errorCode,
          diagnosis:JSON.stringify(diagnostic),gradingSource:q.questionType==='multiple_choice'?'stored_option_key':matchesKey?'exact_normalized_key':'pending_teacher_review',mode:decision.mode}});
        const history = await tx.attempt.findMany({where:{studentId,question:{skillId:q.skillId},correct:{not:null}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:10});
        const old = await tx.masterySnapshot.findUnique({where:{studentId_skillId:{studentId,skillId:q.skillId}}});
        const score = scoreSkill(history.reverse(),old?.difficulty??q.difficulty);
        if (correct!==null) await tx.masterySnapshot.upsert({where:{studentId_skillId:{studentId,skillId:q.skillId}},
          create:{studentId,skillId:q.skillId,tense:q.tense,errorCode:q.errorCode,attempts:1,...score,lastPracticedAt:attempt.createdAt},
          update:{...score,attempts:{increment:1},lastPracticedAt:attempt.createdAt}});
        return {attemptId:attempt.id,correct,correctAnswer:q.correctAnswer,explanationVi:q.explanationVi,diagnosis:diagnostic,
          gradingSource:attempt.gradingSource,requiresTeacherReview:correct===null,mastery:score};
      });
    } catch (error) {
      if (typeof error==='object' && error && 'code' in error && error.code==='P2002') throw new AppError(409,'ALREADY_SUBMITTED','This assignment has already been submitted');
      throw error;
    }
  }
}
