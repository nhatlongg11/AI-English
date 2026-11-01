import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db.js';
import { AiService } from '../src/ai.js';
import { batchSchema, generateSchema, validateBatch } from '../src/domain.js';
import { generationPrompt } from '../src/prompts.js';
if (process.env.RUN_LIVE_GEMINI!=='true') {
  console.log('SKIPPED: set RUN_LIVE_GEMINI=true to opt in to a paid Gemini call.');
} else {
  const config=loadConfig();
  if (config.AI_MOCK_MODE) throw new Error('Live smoke test requires AI_MOCK_MODE=false');
  const db=createDb(config.DATABASE_URL);
  try {
    const request=generateSchema.parse({tense:'present_simple',difficulty:1,questionType:'multiple_choice',count:1});
    const result=await new AiService(db,config).json('live_smoke',batchSchema,generationPrompt(request),()=>{throw new Error('Mock forbidden');});
    validateBatch(result.data,request);
    console.log(JSON.stringify({status:'LIVE_VERIFIED',model:result.model,provenance:result.provenance,questions:result.data.questions.length}));
  } finally {await db.$disconnect();}
}
