import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, utimes } from 'node:fs/promises';
import { parse } from 'dotenv';
import { z } from 'zod';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db.js';
import { hash } from '../src/domain.js';

// Explicit local account provisioning, separate from curriculum/mock data seeding.
const config = loadConfig();
if (process.env.NODE_ENV === 'production' || !['127.0.0.1', 'localhost', '::1'].includes(config.HOST)) {
  throw new Error('Local account seeding requires a loopback HOST and a non-production environment');
}
const accountSchema = z.object({
  label: z.string(), role: z.enum(['admin', 'teacher', 'student']),
  token: z.string().min(32).max(256).regex(/^\S+$/), actorId: z.string(),
  mode: z.enum(['adaptive', 'baseline']).optional(),
});
const manifestSchema = z.object({ version: z.literal(1), accounts: z.array(accountSchema).length(4) });
type Account = z.infer<typeof accountSchema>;
const staffSchema = z.array(z.object({token:z.string().min(32),role:z.enum(['admin','teacher']),actorId:z.string()}));
const envBefore = await readFile('.env', 'utf8');
const envValues = parse(envBefore);
const staff = staffSchema.parse(JSON.parse(envValues.AUTH_CREDENTIALS_JSON ?? '[]'));
const file = '.tmp/local-accounts.json';
let accounts: Account[];
try {
  accounts = manifestSchema.parse(JSON.parse(await readFile(file, 'utf8'))).accounts;
} catch (error) {
  if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
  const token = (role:string) => `${role}-${randomBytes(24).toString('base64url')}`;
  accounts = [
    {label:'Admin',role:'admin',actorId:'local-seed-admin',token:token('admin')},
    {label:'Teacher',role:'teacher',actorId:'local-seed-teacher',token:token('teacher')},
    {label:'Student 1',role:'student',actorId:'',mode:'adaptive',token:token('student1')},
    {label:'Student 2',role:'student',actorId:'',mode:'baseline',token:token('student2')},
  ];
}
if (new Set(accounts.map(a=>a.token)).size !== accounts.length) throw new Error('Duplicate seeded access codes');
for (const account of accounts.filter(a=>a.role !== 'student')) {
  const existing = staff.find(s=>s.actorId === account.actorId);
  if (existing) {
    if (existing.role !== account.role) throw new Error('Seeded staff role conflicts with existing configuration');
    account.token = existing.token;
  } else {
    if (staff.some(s=>s.token===account.token)) throw new Error('Seeded access code conflicts with another account');
    staff.push({token:account.token,role:account.role as 'admin'|'teacher',actorId:account.actorId});
  }
}
const db = createDb(config.DATABASE_URL);
try {
  const teacherId=accounts.find(a=>a.role==='teacher')!.actorId;
  for (const [index,account] of accounts.filter(a=>a.role === 'student').entries()) {
    const displayName=`Học sinh thử ${index+1}`;
    const student = await db.student.upsert({
      where:{tokenHash:hash(account.token)}, update:{},
      create:{tokenHash:hash(account.token),mode:account.mode!,experimentGroup:`local_qa_seed_${account.mode}`,teacherId,displayName,className:'Lớp thử'},
    });
    await db.student.updateMany({where:{id:student.id,teacherId:null},data:{teacherId}});
    await db.student.updateMany({where:{id:student.id,displayName:null},data:{displayName}});
    await db.student.updateMany({where:{id:student.id,className:null},data:{className:'Lớp thử'}});
    account.actorId = student.id;
    account.mode = student.mode as 'adaptive'|'baseline';
  }
  const credentialsLine = `AUTH_CREDENTIALS_JSON=${JSON.stringify(staff)}`;
  const envAfter = /^AUTH_CREDENTIALS_JSON=.*$/m.test(envBefore)
    ? envBefore.replace(/^AUTH_CREDENTIALS_JSON=.*$/m, () => credentialsLine)
    : `${envBefore.trimEnd()}\n${credentialsLine}\n`;
  const updated = parse(envAfter);
  for (const key of Object.keys(envValues)) {
    if (key !== 'AUTH_CREDENTIALS_JSON' && envValues[key] !== updated[key]) throw new Error('Unexpected configuration change');
  }
  await mkdir('.tmp', {recursive:true});
  await writeFile(file, JSON.stringify({version:1,accounts},null,2), {mode:0o600});
  if (envAfter !== envBefore) {
    await writeFile('.env', envAfter);
    // Restart a running source watcher so it loads the new staff credentials.
    const now = new Date();
    await utimes('src/auth.ts', now, now);
  }
  console.log('Local accounts seeded. Existing credentials, Gemini settings and learning records preserved.');
  console.log('Open http://127.0.0.1:5173/login and paste an access code. Accounts use the real API and database.');
  console.table(accounts.map(a=>({account:a.label,role:a.role,mode:a.mode??'',accessCode:a.token})));
  console.log(`Saved in ignored local file ${file}. Re-running reuses the same accounts and codes.`);
  console.log('A compiled npm start server must be restarted to load new staff credentials.');
} finally { await db.$disconnect(); }
