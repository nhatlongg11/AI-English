import { mkdtemp, readFile, readdir, rm, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { seedTaxonomy } from '../src/domain.js';
export const adminToken='test-admin-credential-0123456789-abcdef';
export const teacherToken='test-teacher-credential-0123456789-abcdef';
export const auth=(token=adminToken)=>({authorization:`Bearer ${token}`});
export function testConfig(extra:NodeJS.ProcessEnv={}) {
  return loadConfig({AI_MOCK_MODE:'true',AUTH_CREDENTIALS_JSON:JSON.stringify([
    {token:adminToken,role:'admin',actorId:'admin-test'},{token:teacherToken,role:'teacher',actorId:'teacher-test'}]),...extra});
}
export async function testDb() {
  await mkdir('.tmp',{recursive:true});
  const folder=await mkdtemp(resolve('.tmp','test-'));
  const path=resolve(folder,'test.db');
  const migrations=(await readdir(resolve('prisma/migrations'),{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
  const sql=(await Promise.all(migrations.map(name=>readFile(resolve('prisma/migrations',name,'migration.sql'),'utf8')))).join('\n');
  const native=new DatabaseSync(path);native.exec('BEGIN');native.exec(sql);native.exec('COMMIT');native.close();
  const db=createDb(`file:${path.replaceAll('\\','/')}`);
  await seedTaxonomy(db);
  return {db,url:`file:${path.replaceAll('\\','/')}`,cleanup:async()=>{await db.$disconnect();await rm(folder,{recursive:true,force:true});}};
}
