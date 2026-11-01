import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {PrismaClient,Prisma} from '@prisma/client';
import {z} from 'zod';
import {requireRole,type Actor} from './auth.js';
import {AppError} from './config.js';
import {publicQuestion,questionInclude} from './questions.js';

const ids=z.array(z.uuid()).min(1).max(100).refine(v=>new Set(v).size===v.length,'Duplicate IDs');
const params=z.object({id:z.uuid()}).strict();
const page=z.object({limit:z.coerce.number().int().min(1).max(100).default(30),offset:z.coerce.number().int().min(0).max(1000000).default(0)}).strict();
const status=z.enum(['unmarked','present','absent','late','excused']);
const exerciseInput=z.object({title:z.string().trim().min(1).max(120),instructions:z.string().trim().max(2000).default(''),questionIds:ids,studentIds:ids}).strict();
const studentSelect={id:true,displayName:true,className:true,teacherId:true} as const;
const owner=(actor:Actor)=>actor.role==='admin'?{}:{createdBy:actor.actorId};
const studentScope=(actor:Actor)=>actor.role==='admin'?{}:{teacherId:actor.actorId};
async function checkStudents(db:Prisma.TransactionClient,actor:Actor,studentIds:string[]){
  const count=await db.student.count({where:{id:{in:studentIds},...studentScope(actor)}});
  if(count!==studentIds.length)throw new AppError(403,'FORBIDDEN','Select only students you are responsible for');
}

export function classroomRoutes(api:FastifyInstance,db:PrismaClient){
  api.patch('/learning/students/:id/profile',async req=>{
    requireRole(req,'teacher','admin');const {id}=params.parse(req.params);
    const data=z.object({displayName:z.string().trim().min(1).max(80).nullable().optional(),className:z.string().trim().min(1).max(40).nullable().optional()}).strict().refine(v=>Object.keys(v).length>0,'Supply name or class').parse(req.body);
    const updated=await db.student.updateMany({where:{id,...studentScope(req.actor)},data});
    if(!updated.count)throw new AppError(404,'NOT_FOUND','Student not found');
    return {id,...data};
  });
  api.get('/teaching/lessons',async req=>{
    requireRole(req,'teacher','admin');const query=page.parse(req.query);
    const lessons=await db.attendanceLesson.findMany({where:owner(req.actor),orderBy:[{heldOn:'desc'},{id:'asc'}],take:query.limit,skip:query.offset,
      include:{records:{where:{student:studentScope(req.actor)},select:{status:true}}}});
    return {lessons:lessons.map(({records,...lesson})=>({...lesson,total:records.length,marked:records.filter(r=>r.status!=='unmarked').length})),nextOffset:lessons.length===query.limit?query.offset+lessons.length:null};
  });
  api.post('/teaching/lessons',async(req,reply)=>{
    requireRole(req,'teacher','admin');
    const data=z.object({title:z.string().trim().min(1).max(120),heldOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const date=new Date(s+'T00:00:00Z');return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===s;},'Invalid calendar date'),studentIds:ids}).strict().parse(req.body);
    const lesson=await db.$transaction(async tx=>{await checkStudents(tx,req.actor,data.studentIds);return tx.attendanceLesson.create({data:{title:data.title,heldOn:data.heldOn,createdBy:req.actor.actorId,records:{create:data.studentIds.map(studentId=>({studentId}))}}});});
    return reply.code(201).send({lesson});
  });
  const lessonDetail=async(req:FastifyRequest)=>{
    requireRole(req,'teacher','admin');const {id}=params.parse(req.params);
    const lesson=await db.attendanceLesson.findFirst({where:{id,...owner(req.actor)},include:{records:{where:{student:studentScope(req.actor)},include:{student:{select:studentSelect}},orderBy:{studentId:'asc'}}}});
    if(!lesson)throw new AppError(404,'NOT_FOUND','Lesson not found');return {lesson};
  };
  api.get('/teaching/lessons/:id',lessonDetail);
  api.patch('/teaching/lessons/:id/attendance',async req=>{
    requireRole(req,'teacher','admin');const {id}=params.parse(req.params);
    const {records}=z.object({records:z.array(z.object({studentId:z.uuid(),status}).strict()).min(1).max(100).refine(v=>new Set(v.map(r=>r.studentId)).size===v.length,'Duplicate students')}).strict().parse(req.body);
    await db.$transaction(async tx=>{
      if(!await tx.attendanceLesson.findFirst({where:{id,...owner(req.actor)}}))throw new AppError(404,'NOT_FOUND','Lesson not found');
      await checkStudents(tx,req.actor,records.map(r=>r.studentId));
      const count=await tx.attendanceRecord.count({where:{lessonId:id,studentId:{in:records.map(r=>r.studentId)}}});
      if(count!==records.length)throw new AppError(400,'INVALID_ROSTER','Student is not on this lesson register');
      for(const record of records)await tx.attendanceRecord.update({where:{lessonId_studentId:{lessonId:id,studentId:record.studentId}},data:{status:record.status,markedBy:req.actor.actorId,markedAt:new Date()}});
    });
    return lessonDetail(req);
  });
  api.get('/teaching/exercises',async req=>{
    requireRole(req,'teacher','admin');const query=page.parse(req.query);
    const exercises=await db.exercise.findMany({where:owner(req.actor),orderBy:[{createdAt:'desc'},{id:'asc'}],take:query.limit,skip:query.offset,
      include:{_count:{select:{questions:true}},recipients:{where:{student:studentScope(req.actor)},select:{studentId:true}}}});
    return {exercises:exercises.map(({_count,recipients,...e})=>({...e,questionCount:_count.questions,studentCount:recipients.length})),nextOffset:exercises.length===query.limit?query.offset+exercises.length:null};
  });
  const saveExercise=async(req:FastifyRequest,update=false)=>{
    requireRole(req,'teacher','admin');const data=exerciseInput.parse(req.body);
    return db.$transaction(async tx=>{
      await checkStudents(tx,req.actor,data.studentIds);
      const valid=await tx.question.count({where:{id:{in:data.questionIds},status:{in:['draft','approved']}}});
      if(valid!==data.questionIds.length)throw new AppError(400,'INVALID_QUESTION','Select existing, non-rejected questions');
      const nested={questions:{create:data.questionIds.map((questionId,position)=>({questionId,position}))},recipients:{create:data.studentIds.map(studentId=>({studentId}))}};
      if(!update)return tx.exercise.create({data:{title:data.title,instructions:data.instructions,createdBy:req.actor.actorId,...nested}});
      const {id}=params.parse(req.params);
      const exercise=await tx.exercise.findFirst({where:{id,...owner(req.actor)}});
      if(!exercise)throw new AppError(404,'NOT_FOUND','Exercise not found');
      if(exercise.publishedAt)throw new AppError(409,'EXERCISE_PUBLISHED','Assigned exercises cannot be changed');
      await tx.exerciseQuestion.deleteMany({where:{exerciseId:id}});await tx.exerciseRecipient.deleteMany({where:{exerciseId:id}});
      return tx.exercise.update({where:{id},data:{title:data.title,instructions:data.instructions,...nested}});
    });
  };
  api.post('/teaching/exercises',async(req,reply)=>reply.code(201).send({exercise:await saveExercise(req)}));
  api.patch('/teaching/exercises/:id',async req=>({exercise:await saveExercise(req,true)}));
  api.get('/teaching/exercises/:id',async req=>{
    requireRole(req,'teacher','admin');const {id}=params.parse(req.params);
    const exercise=await db.exercise.findFirst({where:{id,...owner(req.actor)},include:{questions:{include:{question:{include:questionInclude}},orderBy:{position:'asc'}},
      recipients:{where:{student:studentScope(req.actor)},include:{student:{select:studentSelect}},orderBy:{studentId:'asc'}},
      decisions:{where:{student:studentScope(req.actor)},select:{studentId:true,attempt:{select:{correct:true}}}}}});
    if(!exercise)throw new AppError(404,'NOT_FOUND','Exercise not found');
    const {decisions,recipients,...rest}=exercise;
    return {exercise:{...rest,recipients:recipients.map(r=>{
      const attempts=decisions.filter(d=>d.studentId===r.studentId&&d.attempt).map(d=>d.attempt!);
      return {...r,answered:attempts.length,correct:attempts.filter(a=>a.correct===true).length,pending:attempts.filter(a=>a.correct===null).length};
    })}};
  });
  api.post('/teaching/exercises/:id/publish',async req=>{
    requireRole(req,'teacher','admin');const {id}=params.parse(req.params);
    return db.$transaction(async tx=>{
      const e=await tx.exercise.findFirst({where:{id,...owner(req.actor)},include:{questions:{include:{question:true}},recipients:true}});
      if(!e)throw new AppError(404,'NOT_FOUND','Exercise not found');
      if(e.publishedAt)return {exercise:e};
      if(!e.questions.length||!e.recipients.length)throw new AppError(400,'INVALID_EXERCISE','Select questions and students');
      await checkStudents(tx,req.actor,e.recipients.map(r=>r.studentId));
      if(e.questions.some(q=>q.question.status!=='approved'))throw new AppError(409,'QUESTIONS_AWAITING_APPROVAL','All questions need administrator approval before assignment');
      return {exercise:await tx.exercise.update({where:{id},data:{publishedAt:new Date()}})};
    });
  });
  api.get('/learning/exercises',async req=>{
    requireRole(req,'student');const query=page.parse(req.query);
    const exercises=await db.exercise.findMany({where:{publishedAt:{not:null},recipients:{some:{studentId:req.actor.actorId}}},orderBy:[{publishedAt:'desc'},{id:'asc'}],take:query.limit,skip:query.offset,
      select:{id:true,title:true,instructions:true,publishedAt:true,_count:{select:{questions:true}},decisions:{where:{studentId:req.actor.actorId,attempt:{isNot:null}},select:{attempt:{select:{correct:true}}}}}});
    return {exercises:exercises.map(({_count,decisions,...e})=>({...e,questionCount:_count.questions,answered:decisions.length,correct:decisions.filter(d=>d.attempt?.correct===true).length,pending:decisions.filter(d=>d.attempt?.correct===null).length})),nextOffset:exercises.length===query.limit?query.offset+exercises.length:null};
  });
  api.get('/learning/exercises/:id/next-question',async req=>{
    requireRole(req,'student');const {id}=params.parse(req.params);const studentId=req.actor.actorId;
    return db.$transaction(async tx=>{
      const e=await tx.exercise.findFirst({where:{id,publishedAt:{not:null},recipients:{some:{studentId}}},include:{questions:{include:{question:{include:questionInclude}},orderBy:{position:'asc'}}}});
      if(!e)throw new AppError(404,'NOT_FOUND','Assigned exercise not found');
      const answered=await tx.selectionDecision.count({where:{exerciseId:id,studentId,attempt:{isNot:null}}});
      const remaining=e.questions.find(q=>q.question.status!=='approved');
      if(remaining)throw new AppError(409,'QUESTION_NOT_APPROVED','Exercise content is unavailable; ask your teacher');
      const done=await tx.selectionDecision.findMany({where:{exerciseId:id,studentId,attempt:{isNot:null}},select:{questionId:true}});
      const item=e.questions.find(q=>!done.some(d=>d.questionId===q.questionId));
      const summary={id:e.id,title:e.title,instructions:e.instructions,total:e.questions.length,answered};
      if(!item)return {exercise:summary,completed:true,question:null};
      const student=await tx.student.findUniqueOrThrow({where:{id:studentId}});
      const reason={practiceContext:'teacher_assigned_exercise',exerciseId:id,position:item.position};
      const decision=await tx.selectionDecision.upsert({where:{exerciseId_studentId_questionId:{exerciseId:id,studentId,questionId:item.questionId}},update:{},create:{exerciseId:id,studentId,questionId:item.questionId,mode:student.mode,algorithm:'teacher-exercise-v1',reason:JSON.stringify(reason)}});
      return {exercise:summary,completed:false,decisionId:decision.id,question:publicQuestion(item.question),reason,generationNeeded:null};
    });
  });
}
