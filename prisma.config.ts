import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { resolve } from 'node:path';
const url=process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
// CLI and runtime resolve relative files from repository root, including on Windows.
const absoluteUrl=url.startsWith('file:') ? `file:${resolve(url.slice(5)).replaceAll('\\','/')}` : url;
export default defineConfig({
  schema:'prisma/schema.prisma', migrations:{path:'prisma/migrations'},
  datasource:{url:absoluteUrl},
});
