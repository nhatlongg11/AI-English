import { describe,it,expect,vi } from 'vitest';
const sdk=vi.hoisted(()=>({create:vi.fn(),construct:vi.fn()}));
vi.mock('@google/genai',()=>({GoogleGenAI:class {
  interactions={create:sdk.create};
  constructor(options:unknown){sdk.construct(options);}
}}));
import { GeminiTransport } from '../src/ai.js';
import { testConfig } from './helpers.js';
describe('official SDK adapter contract (mock SDK, no live request)',()=>{
  it('uses Interactions structured output, no storage, explicit abort and disables nested retries',async()=>{
    sdk.create.mockResolvedValue({output_text:'{"ok":true}',usage:{total_input_tokens:10,total_output_tokens:5,total_thought_tokens:15,total_tokens:30}});
    const transport=new GeminiTransport(testConfig({GEMINI_API_KEY:'mock-secret-not-sent'}));
    const controller=new AbortController();
    const schema={type:'object',properties:{ok:{type:'boolean'}}};
    const response=await transport.call('gemini-3.5-flash-lite','test prompt',schema,controller.signal);
    expect(sdk.create).toHaveBeenCalledWith(expect.objectContaining({model:'gemini-3.5-flash-lite',store:false,
      response_format:{type:'text',mime_type:'application/json',schema}}),
    expect.objectContaining({signal:controller.signal,retries:{strategy:'none'},timeout_ms:20000}));
    expect(response).toMatchObject({inputTokens:10,outputTokens:20});
  });
});
