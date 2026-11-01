import type { PrismaClient } from '@prisma/client';
import { AiService } from './ai.js';
import { AppError } from './config.js';
import { batchSchema, contentHash, validateBatch, type GenerateRequest, type QuestionInput } from './domain.js';
import { mockQuestions } from './fixtures.js';
import { generationPrompt, PROMPT_VERSION } from './prompts.js';
import { sentenceTokens } from './sentence-tokens.js';

export const questionInclude = {options:{orderBy:{position:'asc' as const}}};
export const MAX_BULK_REVIEW = 5000;

function validateApproval(q: {
  tense:string;difficulty:number;questionType:string;content:string;correctAnswer:string;
  explanationVi:string;grammarRule:string;errorCode:string;options:{text:string;errorCode:string|null}[];
}) {
  validateBatch({questions:[{
    tense:q.tense,difficulty:q.difficulty,questionType:q.questionType,content:q.content,
    correctAnswer:q.correctAnswer,explanationVi:q.explanationVi,grammarRule:q.grammarRule,errorCode:q.errorCode,
    options:q.options.map(option=>({text:option.text,errorCode:option.errorCode})),
  }]},{tense:q.tense as GenerateRequest['tense'],difficulty:q.difficulty,
    questionType:q.questionType as GenerateRequest['questionType'],count:1,modelTier:'primary'});
}

export class QuestionService {
  constructor(private db:PrismaClient,private ai:AiService) {}
  async generate(request:GenerateRequest,actorId?:string) {
    if (request.count > this.ai.config.AI_MAX_QUESTIONS_PER_REQUEST) throw new AppError(400,'COUNT_LIMIT','Requested count exceeds configured limit');
    const result = await this.ai.json('generate',batchSchema,generationPrompt(request),() => mockQuestions(request),request.modelTier);
    const questions = validateBatch(result.data,request);
    try {
      return await this.db.$transaction(questions.map(q => this.db.question.create({data:{...this.createData(q,result.provenance,result.model),createdBy:actorId},include:questionInclude})));
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') throw new AppError(409,'DUPLICATE_CONTENT','Question already exists in bank; reuse or review existing content');
      throw error;
    }
  }
  createData(q:QuestionInput,provenance:string,model:string) {
    return { ...q, contentHash:contentHash(q), skillId:`${q.tense}:${q.errorCode}`, provenance,model,promptVersion:PROMPT_VERSION,
      reviewFlags:JSON.stringify(['teacher_grammar_review_required','single_answer_semantics_unverified',...(provenance==='mock'?['explicit_mock_content','difficulty_and_theme_not_calibrated']:[])]),
      options:{create:q.options.map((o,position) => ({...o,position}))} };
  }
  async review(id:string,action:'approved'|'rejected',actorId:string,note:string) {
    const q = await this.db.question.findUnique({where:{id},include:questionInclude});
    if (!q) throw new AppError(404,'NOT_FOUND','Question not found');
    if (q.status !== 'draft') throw new AppError(409,'ALREADY_REVIEWED','Only draft questions can be reviewed');
    if (action === 'approved') {
      if(q.createdBy===actorId) throw new AppError(403,'SELF_REVIEW_FORBIDDEN','A different administrator must approve this question');
      validateApproval(q);
    }
    const updated = await this.db.question.updateMany({where:{id,status:'draft'},data:{status:action,reviewedBy:actorId,reviewedAt:new Date(),reviewNote:note}});
    if (!updated.count) throw new AppError(409,'ALREADY_REVIEWED','Question has already been reviewed');
    return this.db.question.findUniqueOrThrow({where:{id},include:questionInclude});
  }

  async previewReview(action:'approve'|'reject',actorId:string,filters:{tense?:string;search?:string}) {
    const search=filters.search?.trim();
    const matching=await this.db.question.findMany({
      where:{status:'draft',tense:filters.tense,
        ...(search?{OR:[{content:{contains:search}},{errorCode:{contains:search}}]}:{})},
      select:{id:true,createdBy:true},orderBy:{id:'asc'},take:MAX_BULK_REVIEW+1,
    });
    if(matching.length>MAX_BULK_REVIEW) throw new AppError(400,'BULK_REVIEW_TOO_LARGE','Narrow the filters to at most 5000 drafts');
    const eligible=matching.filter(q=>action!=='approve'||q.createdBy!==actorId);
    return {ids:eligible.map(q=>q.id),matched:matching.length,skippedOwn:matching.length-eligible.length};
  }

  async reviewMany(ids:string[],action:'approved'|'rejected',actorId:string,note:string) {
    return this.db.$transaction(async tx=>{
      const selected=await tx.question.findMany({where:{id:{in:ids}},include:questionInclude});
      if(selected.length!==ids.length||selected.some(q=>q.status!=='draft')) {
        throw new AppError(409,'BULK_REVIEW_CONFLICT','Some questions changed; refresh the selection before reviewing');
      }
      if(action==='approved') {
        if(selected.some(q=>q.createdBy===actorId))throw new AppError(403,'SELF_REVIEW_FORBIDDEN','A different administrator must approve their own questions');
        for(const q of selected)validateApproval(q);
      }
      const updated=await tx.question.updateMany({where:{id:{in:ids},status:'draft'},
        data:{status:action,reviewedBy:actorId,reviewedAt:new Date(),reviewNote:note}});
      if(updated.count!==ids.length)throw new AppError(409,'BULK_REVIEW_CONFLICT','Some questions changed; refresh the selection before reviewing');
      return {reviewed:updated.count,status:action};
    },{timeout:30000});
  }
}

// Explicit allowlist prevents accidental leakage of keys, explanations, skills or distractor mappings.
export function publicQuestion(q:{id:string;tense:string;difficulty:number;questionType:string;content:string;options:{text:string}[];provenance:string;model:string;generatedAt:Date;correctAnswer?:string}) {
  return {id:q.id,tense:q.tense,difficulty:q.difficulty,questionType:q.questionType,content:q.content,
    options:q.options.map(o => o.text),provenance:q.provenance,model:q.model,generatedAt:q.generatedAt,
    ...(q.questionType==='error_correction' && q.correctAnswer?{wordTokens:sentenceTokens(q.id,q.correctAnswer)}:{})};
}
