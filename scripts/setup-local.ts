import { readFile,writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const credentials=[{token:randomBytes(32).toString('base64url'),role:'admin',actorId:'local-admin'},
  {token:randomBytes(32).toString('base64url'),role:'teacher',actorId:'local-teacher'}];
let content=await readFile('.env.example','utf8');
content=content.replace(/^AUTH_CREDENTIALS_JSON=.*$/m,`AUTH_CREDENTIALS_JSON=${JSON.stringify(credentials)}`);
if (process.argv.includes('--mock')) content=content.replace('AI_MOCK_MODE=false','AI_MOCK_MODE=true');
try {await writeFile('.env',content,{flag:'wx'});console.log(`Created .env with random staff credentials. Mode: ${process.argv.includes('--mock')?'EXPLICIT MOCK':'Gemini (key and prices required)'}. Credentials are not printed.`);}
catch (error) {if(typeof error==='object' && error && 'code' in error && error.code==='EEXIST')console.log('.env already exists; preserved unchanged.');else throw error;}
