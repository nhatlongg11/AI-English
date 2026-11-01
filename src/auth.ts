import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError, type Config } from './config.js';
import { hash } from './domain.js';

export type Actor = {role:'admin'|'teacher'|'student';actorId:string};
declare module 'fastify' { interface FastifyRequest {actor:Actor} }
const credentialSchema = z.array(z.object({token:z.string().min(32),role:z.enum(['admin','teacher']),actorId:z.string().min(1).max(100)}).strict());
export const newStudentToken = () => randomBytes(32).toString('base64url');
export function authenticator(db:PrismaClient,config:Config) {
  const credentials = credentialSchema.parse(JSON.parse(config.AUTH_CREDENTIALS_JSON));
  if (new Set(credentials.map(c=>c.token)).size!==credentials.length) throw new Error('Duplicate authentication token configuration');
  return async (req:FastifyRequest) => {
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!token || token.length>256) throw new AppError(401,'UNAUTHORIZED','A valid bearer token is required');
    const digest = Buffer.from(hash(token));
    const staff = credentials.find(c=>timingSafeEqual(digest,Buffer.from(hash(c.token))));
    if (staff) {req.actor={role:staff.role,actorId:staff.actorId};return;}
    const student = await db.student.findUnique({where:{tokenHash:hash(token)}});
    if (!student) throw new AppError(401,'UNAUTHORIZED','Invalid bearer token');
    req.actor={role:'student',actorId:student.id};
  };
}
export function requireRole(req:FastifyRequest,...roles:Actor['role'][]) {
  if (!roles.includes(req.actor.role)) throw new AppError(403,'FORBIDDEN','This role cannot perform this operation');
}
export function requireStudent(req:FastifyRequest,id:string) {
  if (req.actor.role!=='student' || req.actor.actorId!==id) throw new AppError(403,'FORBIDDEN','Only the student may access this learning record');
}
