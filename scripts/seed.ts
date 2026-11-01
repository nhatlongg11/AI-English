import { createDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { seedTaxonomy, contentHash } from '../src/domain.js';
import { AiService } from '../src/ai.js';
import { QuestionService } from '../src/questions.js';
import { grammarExamples } from '../src/fixtures.js';
const config=loadConfig();
const db=createDb(config.DATABASE_URL);
try {
  await seedTaxonomy(db);
  if (process.argv.includes('--examples')) {
    if (!config.AI_MOCK_MODE) throw new Error('Example seeding requires AI_MOCK_MODE=true');
    const service=new QuestionService(db,new AiService(db,config));
    for (const q of grammarExamples) await db.question.upsert({where:{contentHash:contentHash(q)},
      create:service.createData(q,'mock','authored-example-v1'),update:{}});
    console.log('30 explicitly labeled mock examples saved as drafts. Teacher review required.');
  }
  console.log('Taxonomy and skills seeded.');
} finally {await db.$disconnect();}
