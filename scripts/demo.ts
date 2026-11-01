import { mkdtemp,mkdir,readFile,readdir,rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { seedTaxonomy } from '../src/domain.js';

await mkdir('.tmp',{recursive:true});
const folder=await mkdtemp(resolve('.tmp','demo-'));
const path=resolve(folder,'demo.db');
const native=new DatabaseSync(path);
const migrations=(await readdir('prisma/migrations',{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
native.exec('BEGIN');
for(const name of migrations) native.exec(await readFile(`prisma/migrations/${name}/migration.sql`,'utf8'));
native.exec('COMMIT');native.close();
const token=randomBytes(32).toString('base64url');
const authorToken=randomBytes(32).toString('base64url');
const config=loadConfig({AI_MOCK_MODE:'true',AUTH_CREDENTIALS_JSON:JSON.stringify([{token,role:'admin',actorId:'mock-demo-reviewer'},{token:authorToken,role:'teacher',actorId:'mock-demo-author'}])});
const db=createDb(`file:${path.replaceAll('\\','/')}`);
await seedTaxonomy(db);
const app=await buildApp({config,db});
const headers={authorization:`Bearer ${token}`};
try {
  const generated=await app.inject({method:'POST',url:'/api/v1/ai/questions/generate',headers:{authorization:`Bearer ${authorToken}`},payload:{tense:'present_simple',difficulty:1,questionType:'multiple_choice',count:3}});
  if (generated.statusCode!==200) throw new Error(generated.body);
  const qs=generated.json().questions;
  for(const q of qs) {
    const reviewed=await app.inject({method:'POST',url:`/api/v1/ai/questions/${q.id}/approve`,headers,
      payload:{checkedGrammarAndAnswer:true,note:'SIMULATED review of authored mock example in disposable demonstration database'}});
    if(reviewed.statusCode!==200) throw new Error(reviewed.body);
  }
  const provisioned=await app.inject({method:'POST',url:'/api/v1/learning/students',headers,payload:{mode:'adaptive',experimentGroup:'demo'}});
  const student=provisioned.json();
  const studentHeaders={authorization:`Bearer ${student.token}`};
  const selected=await app.inject({url:`/api/v1/learning/students/${student.id}/next-question`,headers:studentHeaders});
  const next=selected.json();
  const q=qs.find((item:{id:string})=>item.id===next.question.id);
  const graded=await app.inject({method:'POST',url:'/api/v1/learning/attempts',headers:studentHeaders,payload:{decisionId:next.decisionId,answer:q.options.find((o:{errorCode:string|null})=>o.errorCode).text}});
  if (graded.statusCode!==200) throw new Error(graded.body);
  const exported=await app.inject({url:'/api/v1/research/export',headers});
  console.log(JSON.stringify({mode:'EXPLICIT_MOCK_DEMONSTRATION',review:'SIMULATED; temporary database removed after run',
    generated:qs.length,studentQuestion:next.question,selectionReason:next.reason,
    grading:graded.json(),researchRows:exported.json().rows.length,aiCostUsd:0},null,2));
} finally {await app.close();await db.$disconnect();await rm(folder,{recursive:true,force:true});}
