import Fastify, { LogController } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { z, ZodError } from "zod";
import type { PrismaClient } from "@prisma/client";
import { AppError, loadConfig, type Config } from "./config.js";
import { createDb } from "./db.js";
import { AiService, type AiTransport } from "./ai.js";
import { generateSchema, hash, tenseSchema, typeSchema } from "./domain.js";
import {
  authenticator,
  requireRole,
  requireStudent,
  newStudentToken,
} from "./auth.js";
import { QuestionService, questionInclude } from "./questions.js";
import { DiagnosisService } from "./diagnosis.js";
import { LearningService } from "./learning.js";
import { QuestionAuthoringService, importRequestSchema } from './question-authoring.js';
import {classroomRoutes} from './classroom.js';
import {AiSupportService,aiSupportRoutes} from './ai-support.js';

const idParams = z.object({ id: z.uuid() }).strict();
const answerSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine(
    (v) =>
      !/[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|\+?\d[\d ()-]{7,}\d/i.test(v),
    "Use only an exercise answer; contact details and URLs are not allowed",
  );
const csvCell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
};

export async function buildApp(
  options: { config?: Config; db?: PrismaClient; transport?: AiTransport } = {},
) {
  const config = options.config ?? loadConfig();
  const db = options.db ?? createDb(config.DATABASE_URL);
  const app = Fastify({
    bodyLimit: 16384,
    logger: { redact: ["req.headers.authorization"] },
    logController: new LogController({ disableRequestLogging: true }),
  });
  const authenticate = authenticator(db, config);
  const teacherIds = [...new Set((JSON.parse(config.AUTH_CREDENTIALS_JSON) as {role:string;actorId:string}[]).filter(c=>c.role==='teacher').map(c=>c.actorId))];
  const validateTeacher = (id:string|null|undefined) => {
    if(id && !teacherIds.includes(id)) throw new AppError(400,'INVALID_TEACHER','Choose a configured teacher');
  };
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    hook: "onRequest",
  });
  const ai = new AiService(db, config, options.transport);
  const questions = new QuestionService(db, ai);
  const diagnosis = new DiagnosisService(db, ai);
  const learning = new LearningService(db, diagnosis);
  const authoring = new QuestionAuthoringService(db);
  const support=new AiSupportService(db,ai);
  const aiLimit = {
    rateLimit: { max: config.AI_RATE_LIMIT_PER_MINUTE, timeWindow: "1 minute" },
  };
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError)
      return reply
        .code(400)
        .send({
          error: "VALIDATION_ERROR",
          message: "Invalid request or response shape",
          issues: error.issues.map((i) => ({
            path: i.path,
            message: i.message,
          })),
        });
    if (error instanceof AppError)
      return reply
        .code(error.statusCode)
        .send({ error: error.code, message: error.message });
    const status =
      typeof error === "object" && error && "statusCode" in error
        ? Number(error.statusCode)
        : 500;
    return reply
      .code(status >= 400 && status < 500 ? status : 500)
      .send({
        error:
          status === 429
            ? "RATE_LIMITED"
            : status === 413
              ? "BODY_TOO_LARGE"
              : "REQUEST_FAILED",
        message: status >= 500 ? "Internal service error" : "Request rejected",
      });
  });
  app.get("/", async (_req, reply) => {
    return reply.redirect("/api/v1/health");
  });
  app.get("/api/v1/health", async (_req, reply) => {
    try {
      await db.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        aiMode: config.AI_MOCK_MODE ? "explicit_mock" : "gemini",
        version: "1.0.0",
      };
    } catch {
      return reply.code(503).send({ status: "database_unavailable" });
    }
  });
  app.register(
    async (api) => {
      api.addHook("onRequest", authenticate);
      classroomRoutes(api,db);
      aiSupportRoutes(api,support,config.AI_RATE_LIMIT_PER_MINUTE);
      api.get("/auth/session", async (req) => {
        const student =
          req.actor.role === "student"
            ? await db.student.findUniqueOrThrow({
                where: { id: req.actor.actorId },
                select: { mode: true, experimentGroup: true },
              })
            : null;
        return { ...req.actor, ...student };
      });
      api.post("/ai/questions/generate", { config: aiLimit }, async (req) => {
        requireRole(req, "admin", "teacher");
        const data = generateSchema.parse(req.body);
        if (data.modelTier === "advanced") requireRole(req, "admin");
        return { questions: await questions.generate(data,req.actor.actorId) };
      });
      api.post('/questions',async(req,reply)=>{
        requireRole(req,'admin','teacher');
        const result=await authoring.save([req.body],req.actor.actorId,'teacher_manual',false);
        return reply.code(201).send({question:result.questions[0]});
      });
      api.post('/questions/import/preview',{bodyLimit:512*1024},async(req)=>{
        requireRole(req,'admin','teacher');
        const data=importRequestSchema.parse(req.body);
        return authoring.preview(data.questions);
      });
      api.post('/questions/import',{bodyLimit:512*1024},async(req,reply)=>{
        requireRole(req,'admin','teacher');
        const data=importRequestSchema.parse(req.body);
        return reply.code(201).send(await authoring.save(data.questions,req.actor.actorId,'teacher_import',data.skipDuplicates));
      });
      api.get("/ai/questions", async (req) => {
        requireRole(req, "admin", "teacher");
        const query = z
          .object({
            status: z.enum(["draft", "approved", "rejected"]).optional(),
            tense: tenseSchema.optional(),
            limit: z.coerce.number().int().min(1).max(100).default(30),
            offset: z.coerce.number().int().min(0).max(100000).default(0),
          })
          .strict()
          .parse(req.query);
        return {
          questions: await db.question.findMany({
            where: { status: query.status, tense: query.tense },
            include: questionInclude,
            orderBy: [{ generatedAt: "desc" }, { id: "asc" }],
            take: query.limit,
            skip: query.offset,
          }),
        };
      });
      for (const [action, status] of [
        ["approve", "approved"],
        ["reject", "rejected"],
      ] as const) {
        api.post(`/ai/questions/:id/${action}`, async (req) => {
          requireRole(req, "admin");
          const { id } = idParams.parse(req.params);
          const body = z
            .object({
              note: z.string().trim().min(5).max(500),
              checkedGrammarAndAnswer: z.boolean().optional(),
            })
            .strict()
            .parse(req.body);
          if (action === "approve" && !body.checkedGrammarAndAnswer)
            throw new AppError(
              400,
              "REVIEW_ATTESTATION_REQUIRED",
              "Administrator must check grammar, answer uniqueness, difficulty, and distractor mappings",
            );
          return questions.review(id, status, req.actor.actorId, body.note);
        });
      }
      api.post("/learning/students", async (req, reply) => {
        requireRole(req, "admin", "teacher");
        const data = z
          .object({
            mode: z.enum(["adaptive", "baseline"]),
            teacherId: z.string().min(1).max(100).nullable().optional(),
            displayName:z.string().trim().min(1).max(80).optional(),
            className:z.string().trim().min(1).max(40).optional(),
            experimentGroup: z
              .string()
              .trim()
              .min(1)
              .max(40)
              .regex(/^[a-zA-Z0-9_-]+$/),
          })
          .strict()
          .parse(req.body);
        if(req.actor.role==='teacher' && data.teacherId!==undefined && data.teacherId!==req.actor.actorId)
          throw new AppError(403,'FORBIDDEN','Teachers can create access only for their own students');
        const teacherId=req.actor.role==='teacher'?req.actor.actorId:data.teacherId??null;
        validateTeacher(teacherId);
        const token = newStudentToken();
        const student = await db.student.create({
          data: { ...data, teacherId, tokenHash: hash(token) },
        });
        return reply
          .code(201)
          .send({
            id: student.id,
            token,
            mode: student.mode,
            experimentGroup: student.experimentGroup,
            teacherId: student.teacherId,
          });
      });
      api.get('/learning/teachers',async(req)=>{
        requireRole(req,'admin');
        return {teachers:teacherIds.map(id=>({id,label:id}))};
      });
      api.get('/learning/students',async(req)=>{
        requireRole(req,'admin','teacher');
        const query=z.object({limit:z.coerce.number().int().min(1).max(100).default(100),offset:z.coerce.number().int().min(0).max(1000000).default(0)}).strict().parse(req.query);
        const students=await db.student.findMany({where:req.actor.role==='teacher'?{teacherId:req.actor.actorId}:{},select:{id:true,displayName:true,className:true,mode:true,experimentGroup:true,teacherId:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'asc'}],take:query.limit,skip:query.offset});
        const counts=await db.attempt.groupBy({by:['studentId','correct'],where:{studentId:{in:students.map(s=>s.id)}},_count:true});
        return {students:students.map(s=>{
          const groups=counts.filter(c=>c.studentId===s.id);
          return {...s,total:groups.reduce((n,c)=>n+c._count,0),confirmed:groups.filter(c=>c.correct!==null).reduce((n,c)=>n+c._count,0),correct:groups.filter(c=>c.correct===true).reduce((n,c)=>n+c._count,0)};
        }),nextOffset:students.length===query.limit?query.offset+students.length:null};
      });
      api.patch('/learning/students/:id/teacher',async(req)=>{
        requireRole(req,'admin');
        const {id}=idParams.parse(req.params);
        const {teacherId}=z.object({teacherId:z.string().min(1).max(100).nullable()}).strict().parse(req.body);
        validateTeacher(teacherId);
        const result=await db.student.updateMany({where:{id},data:{teacherId}});
        if(!result.count) throw new AppError(404,'NOT_FOUND','Student not found');
        return {id,teacherId};
      });
      api.get("/learning/students/:id/next-question", async (req) => {
        const { id } = idParams.parse(req.params);
        requireStudent(req, id);
        const scope = z
          .object({
            tense: tenseSchema.optional(),
            questionType: typeSchema.optional(),
          })
          .strict()
          .parse(req.query);
        return learning.next(id, scope);
      });
      api.get("/learning/students/:id/summary", async (req) => {
        const { id } = idParams.parse(req.params);
        requireStudent(req, id);
        const [skills, attempts, total, confirmed, correct] = await Promise.all(
          [
            db.masterySnapshot.findMany({
              where: { studentId: id },
              orderBy: { skillId: "asc" },
            }),
            db.attempt.findMany({
              where: { studentId: id },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 100,
              select: {
                id: true,
                correct: true,
                errorCode: true,
                createdAt: true,
                mode: true,
                question: { select: { tense: true, content: true } },
              },
            }),
            db.attempt.count({ where: { studentId: id } }),
            db.attempt.count({
              where: { studentId: id, correct: { not: null } },
            }),
            db.attempt.count({ where: { studentId: id, correct: true } }),
          ],
        );
        const available = await db.question.groupBy({
          by: ["tense", "questionType"],
          where: { status: "approved" },
          _count: true,
        });
        return {
          skills,
          attempts,
          total,
          confirmed,
          correct,
          xp: correct * 10,
          available,
          activityWindow: 100,
        };
      });
      api.get("/learning/students/:id/mastery", async (req) => {
        const { id } = idParams.parse(req.params);
        requireStudent(req, id);
        return {
          algorithm: "weighted-window-v1",
          skills: await db.masterySnapshot.findMany({
            where: { studentId: id },
            orderBy: { skillId: "asc" },
          }),
        };
      });
      api.post("/learning/attempts", { config: aiLimit }, async (req) => {
        requireRole(req, "student");
        const body = z
          .object({
            decisionId: z.uuid(),
            answer: answerSchema.optional(),
            tokenIds: z
              .array(z.string().regex(/^[a-f0-9]{24}$/))
              .min(1)
              .max(100)
              .optional(),
          })
          .strict()
          .refine(
            (v) => Boolean(v.answer) !== Boolean(v.tokenIds),
            "Supply answer or tokenIds, exclusively",
          )
          .parse(req.body);
        return learning.submit(
          req.actor.actorId,
          body.decisionId,
          body.answer ?? "",
          body.tokenIds,
        );
      });
      api.get("/learning/assignments/:id/result", async (req) => {
        requireRole(req, "student"); const { id } = idParams.parse(req.params);
        const attempt = await db.attempt.findFirst({where:{decisionId:id,studentId:req.actor.actorId},include:{question:true}});
        if(!attempt) throw new AppError(404,"NOT_FOUND","Submitted assignment not found");
        const skill=await db.masterySnapshot.findUnique({where:{studentId_skillId:{studentId:req.actor.actorId,skillId:attempt.question.skillId}}});
        return {attemptId:attempt.id,correct:attempt.correct,correctAnswer:attempt.question.correctAnswer,explanationVi:attempt.question.explanationVi,
          diagnosis:JSON.parse(attempt.diagnosis),gradingSource:attempt.gradingSource,requiresTeacherReview:attempt.correct===null,
          mastery:{mastery:skill?.mastery??0.5},recovered:true};
      });
      api.post("/ai/diagnose", { config: aiLimit }, async (req) => {
        requireRole(req, "student");
        const { attemptId } = z
          .object({ attemptId: z.uuid() })
          .strict()
          .parse(req.body);
        const attempt = await db.attempt.findFirst({
          where: { id: attemptId, studentId: req.actor.actorId },
        });
        if (!attempt) throw new AppError(404, "NOT_FOUND", "Attempt not found");
        // Feedback generated during submission is reused; this endpoint never reveals an unanswered key.
        return {
          diagnosis: JSON.parse(attempt.diagnosis),
          gradingSource: attempt.gradingSource,
        };
      });
      api.get("/ai/usage", async (req) => {
        requireRole(req, "admin");
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        const daily = await db.aiUsage.aggregate({
          where: { createdAt: { gte: start } },
          _sum: {
            estimatedCostUsd: true,
            inputTokens: true,
            outputTokens: true,
          },
          _count: true,
        });
        return {
          dayUtc: start.toISOString().slice(0, 10),
          budgetUsd: config.AI_DAILY_BUDGET_USD,
          totals: daily,
          recent: await db.aiUsage.findMany({
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        };
      });
      api.get("/ai/content-needs", async (req) => {
        requireRole(req, "admin", "teacher");
        const needs = await db.selectionDecision.findMany({
          where: { generationRequest: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        return {
          needs: needs.map((n) => ({
            request: JSON.parse(n.generationRequest!),
            createdAt: n.createdAt,
          })),
        };
      });
      for(const path of ['/research/export','/learning/reports']) api.get(path, async (req, reply) => {
        requireRole(req, ...(path==='/research/export'?['admin'] as const:['admin','teacher'] as const));
        const query = z
          .object({
            format: z.enum(["json", "csv"]).default("json"),
            limit: z.coerce.number().int().min(1).max(1000).default(1000),
            offset: z.coerce.number().int().min(0).max(1000000).default(0),
          })
          .strict()
          .parse(req.query);
        const attempts = await db.attempt.findMany({
          where:req.actor.role==='teacher'?{student:{teacherId:req.actor.actorId}}:{},
          include: { student: true, question: true, decision: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: query.limit,
          skip: query.offset,
        });
        const rows = attempts.map((a) => ({
          attemptId: a.id,
          anonymousStudentId: a.studentId,
          questionId: a.questionId,
          tense: a.question.tense,
          skillId: a.question.skillId,
          correct: a.correct,
          errorCode: a.errorCode,
          createdAt: a.createdAt.toISOString(),
          mode: a.mode,
          experimentGroup: a.student.experimentGroup,
          gradingSource: a.gradingSource,
          algorithm: a.decision.algorithm,
          reason: a.decision.reason,
          answerHash: hash(a.answer),
          provenance: a.question.provenance,
        }));
        // Free-text answers/diagnoses excluded: a learner could type personal information.
        if (query.format === "json")
          return {
            rows,
            nextOffset:
              rows.length === query.limit ? query.offset + rows.length : null,
          };
        const columns = [
          "attemptId",
          "anonymousStudentId",
          "questionId",
          "tense",
          "skillId",
          "correct",
          "errorCode",
          "createdAt",
          "mode",
          "experimentGroup",
          "gradingSource",
          "algorithm",
          "reason",
          "answerHash",
          "provenance",
        ] as const;
        reply.header(
          "Content-Disposition",
          'attachment; filename="tenselab-research.csv"',
        );
        return reply
          .type("text/csv; charset=utf-8")
          .send(
            [
              columns.join(","),
              ...rows.map((r) => columns.map((k) => csvCell(r[k])).join(",")),
            ].join("\r\n"),
          );
      });
      api.delete("/learning/students/:id", async (req, reply) => {
        const { id } = idParams.parse(req.params);
        if (req.actor.role !== "admin") requireStudent(req, id);
        const deleted = await db.student.deleteMany({ where: { id } });
        if (!deleted.count)
          throw new AppError(404, "NOT_FOUND", "Student not found");
        return reply.code(204).send();
      });
    },
    { prefix: "/api/v1" },
  );
  if (!options.db)
    app.addHook("onClose", async () => {
      await db.$disconnect();
    });
  return app;
}
