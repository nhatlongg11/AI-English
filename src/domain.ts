import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { AppError } from './config.js';

export const tenses = ['present_simple', 'present_continuous', 'past_simple'] as const;
export const errorCodes = ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08'] as const;
export const taxonomy = {
  E01: 'Sự hòa hợp chủ ngữ – động từ', E02: 'Chọn sai thì', E03: 'Thiếu trợ động từ',
  E04: 'Sai dạng động từ quá khứ', E05: 'Sai cấu trúc câu hỏi', E06: 'Sai cấu trúc phủ định',
  E07: 'Sai dạng động từ V-ing', E08: 'Dùng sai trợ động từ',
};
export const tenseSchema = z.enum(tenses);
export const errorSchema = z.enum(errorCodes);
export const typeSchema = z.enum(['multiple_choice', 'fill_in_blank', 'error_correction']);
export const generateSchema = z.object({
  tense: tenseSchema, difficulty: z.number().int().min(1).max(5), questionType: typeSchema,
  count: z.number().int().min(1).max(10), targetErrorCode: errorSchema.optional(),
  vocabularyTheme: z.string().trim().min(1).max(80).regex(/^[\p{L}\p{N} ,'-]+$/u).optional(),
  modelTier: z.enum(['primary', 'advanced']).default('primary'),
}).strict();
export type GenerateRequest = z.infer<typeof generateSchema>;
export const questionSchema = z.object({
  tense: tenseSchema, difficulty: z.number().int().min(1).max(5), questionType: typeSchema,
  content: z.string().trim().min(8).max(600),
  options: z.array(z.object({ text: z.string().trim().min(1).max(200), errorCode: errorSchema.nullable() }).strict()).max(5),
  correctAnswer: z.string().trim().min(1).max(300),
  explanationVi: z.string().trim().min(12).max(1500), grammarRule: z.string().trim().min(5).max(500),
  errorCode: errorSchema,
}).strict();
export type QuestionInput = z.infer<typeof questionSchema>;
export const batchSchema = z.object({ questions: z.array(questionSchema).min(1).max(10) }).strict();
export const diagnosisSchema = z.object({
  status: z.enum(['classified', 'uncertain', 'unclassified']),
  correctedSentence: z.string().max(600).nullable(),
  errorCodes: z.array(errorSchema).max(3), explanationVi: z.string().min(5).max(1500),
}).strict().superRefine((v, ctx) => {
  if ((v.status !== 'classified' && v.errorCodes.length) ||
      (v.status === 'classified' && (!v.errorCodes.length || !v.correctedSentence)) ||
      new Set(v.errorCodes).size !== v.errorCodes.length) {
    ctx.addIssue({code: 'custom', message: 'Inconsistent diagnosis'});
  }
});
export type Diagnosis = z.infer<typeof diagnosisSchema>;
export const normalize = (v: string) => v.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export const hash = (v: string) => createHash('sha256').update(v).digest('hex');
export const contentHash = (q: Pick<QuestionInput, 'content'>) => hash(normalize(q.content));

export function validateBatch(raw: unknown, request: GenerateRequest): QuestionInput[] {
  const { questions } = batchSchema.parse(raw);
  if (questions.length !== request.count) throw new AppError(502, 'INVALID_AI_OUTPUT', 'Incorrect question count');
  const seen = new Set<string>();
  for (const q of questions) {
    const fail = (message: string): never => { throw new AppError(502, 'INVALID_AI_OUTPUT', message); };
    if (q.tense !== request.tense || q.difficulty !== request.difficulty || q.questionType !== request.questionType ||
       (request.targetErrorCode && q.errorCode !== request.targetErrorCode)) fail('Question does not match requested scope');
    if (seen.has(contentHash(q))) fail('Duplicate question');
    seen.add(contentHash(q));
    if (!/[ăâđêôơưĂÂĐÊÔƠƯà-ỹ]/u.test(q.explanationVi)) fail('Vietnamese explanation required');
    if (q.questionType === 'multiple_choice') {
      if (q.options.length < 3 || new Set(q.options.map(o => normalize(o.text))).size !== q.options.length) fail('Options must be distinct (3–5)');
      const correct = q.options.filter(o => normalize(o.text) === normalize(q.correctAnswer));
      if (correct.length !== 1 || correct[0]!.errorCode !== null) fail('Exactly one answer option must match the answer key, without an error mapping');
    } else if (q.options.length) fail('Free text questions cannot have options');
    if (q.questionType === 'fill_in_blank' && (q.content.match(/____/g) ?? []).length !== 1) fail('Exactly one ____ blank required');
    if (q.questionType === 'fill_in_blank' && !/____\s*\([a-z]+(?:[ '-][a-z]+)*\)/i.test(q.content)) fail('A base-form verb cue in parentheses must follow the blank');
  }
  return questions;
}

export async function seedTaxonomy(db: PrismaClient) {
  await db.$transaction(async tx=>{
  for (const tense of tenses) {
    await tx.topic.upsert({where: {id: tense}, create: {id: tense, nameVi: ({present_simple:'Hiện tại đơn',present_continuous:'Hiện tại tiếp diễn',past_simple:'Quá khứ đơn'})[tense]}, update: {}});
  }
  for (const code of errorCodes) {
    await tx.errorCategory.upsert({where: {code}, create: {code, nameVi: taxonomy[code]}, update: {}});
    for (const tense of tenses) {
      await tx.skill.upsert({where: {id: `${tense}:${code}`}, create: {id:`${tense}:${code}`, topicId:tense, errorCode:code}, update:{}});
    }
  }
  });
}
