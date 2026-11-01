import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from './config.js';
import { contentHash, questionSchema, validateBatch, type QuestionInput } from './domain.js';
import { questionInclude } from './questions.js';

export const importRequestSchema=z.object({questions:z.array(z.unknown()).min(1).max(50),skipDuplicates:z.boolean().default(true)}).strict();
export interface ImportRow {row:number;content:string;valid:boolean;duplicate:'bank'|'file'|null;errors:string[]}
const fields:Record<string,string>={tense:'Chủ đề',difficulty:'Độ khó',questionType:'Dạng bài',content:'Câu hỏi',options:'Các lựa chọn',correctAnswer:'Đáp án đúng',explanationVi:'Giải thích tiếng Việt',grammarRule:'Quy tắc',errorCode:'Kỹ năng'};
const semanticMessages:Record<string,string>={
  'Vietnamese explanation required':'Phần giải thích cần được viết bằng tiếng Việt.',
  'Options must be distinct (3–5)':'Câu trắc nghiệm cần 3–5 lựa chọn khác nhau.',
  'Exactly one answer option must match the answer key, without an error mapping':'Đáp án đúng phải khớp đúng một lựa chọn và không được gắn lỗi.',
  'Free text questions cannot have options':'Bài điền từ hoặc sửa lỗi không dùng các lựa chọn trắc nghiệm.',
  'Exactly one ____ blank required':'Bài điền từ cần đúng một chỗ trống ____.',
  'A base-form verb cue in parentheses must follow the blank':'Thêm động từ gợi ý sau chỗ trống, ví dụ: ____ (walk).',
};
export function checkAuthoredQuestion(raw:unknown):{question?:QuestionInput;errors:string[]} {
  const parsed=questionSchema.safeParse(raw);
  if(!parsed.success) return {errors:parsed.error.issues.map(issue=>{
    const field=fields[String(issue.path[0])]??'Thông tin câu hỏi';
    if(issue.code==='too_small') return `${field}: cần ít nhất ${issue.minimum} ${issue.origin==='string'?'ký tự':issue.origin==='array'?'lựa chọn':'đơn vị'}.`;
    if(issue.code==='too_big') return `${field}: vượt giới hạn ${issue.maximum}.`;
    if(issue.code==='unrecognized_keys') return 'Có cột hoặc trường không được hỗ trợ. Hãy dùng tệp mẫu.';
    return `${field}: còn thiếu hoặc chưa đúng định dạng.`;
  })};
  const question=parsed.data;
  try {
    validateBatch({questions:[question]},{tense:question.tense,difficulty:question.difficulty,questionType:question.questionType,count:1,modelTier:'primary'});
    return {question,errors:[]};
  } catch(error) {
    return {errors:[error instanceof AppError ? semanticMessages[error.message]??'Câu hỏi chưa đáp ứng yêu cầu. Hãy kiểm tra lại đề bài và đáp án.' : 'Câu hỏi chưa đúng định dạng.']};
  }
}
export class QuestionAuthoringService {
  constructor(private db:PrismaClient) {}
  private async assess(raw:unknown[],db:Pick<PrismaClient,'question'>=this.db) {
    const checked=raw.map(checkAuthoredQuestion);
    const existing=await db.question.findMany({where:{contentHash:{in:checked.flatMap(c=>c.question?[contentHash(c.question)]:[])}},select:{contentHash:true}});
    const hashes=new Set(existing.map(q=>q.contentHash));const seen=new Set<string>();
    const rows:ImportRow[]=checked.map((item,index)=>{
      const q=item.question;const digest=q?contentHash(q):null;
      const duplicate=digest?(seen.has(digest)?'file':hashes.has(digest)?'bank':null):null;
      if(digest)seen.add(digest);
      const input=raw[index];
      const content=q?.content??(typeof input==='object'&&input!==null&&'content' in input&&typeof input.content==='string'?input.content.slice(0,600):'');
      return {row:index+1,content,valid:Boolean(q),duplicate,errors:item.errors};
    });
    return {rows,checked,invalidCount:rows.filter(r=>!r.valid).length,duplicateCount:rows.filter(r=>r.duplicate).length,readyCount:rows.filter(r=>r.valid&&!r.duplicate).length};
  }
  async preview(raw:unknown[]) {
    const {checked:_checked,...preview}=await this.assess(raw);return preview;
  }
  private data(question:QuestionInput,actorId:string,source:'teacher_manual'|'teacher_import') {
    return {...question,contentHash:contentHash(question),skillId:`${question.tense}:${question.errorCode}`,
      provenance:source,model:'human',promptVersion:'teacher-authoring-v1',createdBy:actorId,
      reviewFlags:JSON.stringify(['teacher_grammar_review_required','single_answer_semantics_unverified']),
      options:{create:question.options.map((option,position)=>({...option,position}))}};
  }
  async save(raw:unknown[],actorId:string,source:'teacher_manual'|'teacher_import',skipDuplicates:boolean) {
    try {
      return await this.db.$transaction(async tx=>{
        const assessment=await this.assess(raw,tx);
        if(assessment.invalidCount)throw new AppError(400,'INVALID_QUESTION',`Có ${assessment.invalidCount} câu cần sửa. Hãy xem lại phần kiểm tra trước khi lưu.`);
        if(!skipDuplicates&&assessment.duplicateCount)throw new AppError(409,'DUPLICATE_CONTENT','Có câu đã tồn tại. Hãy bật bỏ qua câu trùng hoặc sửa nội dung.');
        const questions=[];
        for(const [index,row] of assessment.rows.entries()) {
          if(row.duplicate)continue;
          questions.push(await tx.question.create({data:this.data(assessment.checked[index]!.question!,actorId,source),include:questionInclude}));
        }
        return {questions,skipped:assessment.duplicateCount};
      });
    } catch(error) {
      if(typeof error==='object'&&error&&'code' in error&&error.code==='P2002')throw new AppError(409,'DUPLICATE_CONTENT','Nội dung vừa được thêm vào kho. Hãy kiểm tra lại trước khi lưu.');
      throw error;
    }
  }
}
