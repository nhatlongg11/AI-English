import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
export const createDb = (url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db') =>
  new PrismaClient({adapter:new PrismaBetterSqlite3({url})});
