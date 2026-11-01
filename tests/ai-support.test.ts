import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {buildApp} from '../src/app.js';
import {grammarExamples} from '../src/fixtures.js';
import {hash} from '../src/domain.js';
import {testConfig,testDb,auth,teacherToken,adminToken} from './helpers.js';
import type {AiTransport} from '../src/ai.js';

const otherToken='another-teacher-ai-0123456789-abcdef';
const explanation={ruleVi:'Dùng dạng động từ phù hợp với chủ ngữ.',stepsVi:['Xác định chủ ngữ và dấu hiệu thời gian.','Chọn dạng động từ theo cấu trúc của thì.'],example:{sentence:'He reads every evening.',meaningVi:'Bạn ấy đọc sách mỗi tối.'},encouragementVi:'Hãy thử giải thích lại quy tắc bằng lời của em nhé.'};
describe('AI learning and teaching support',()=>{
  let fixture:Awaited<ReturnType<typeof testDb>>;let app:Awaited<ReturnType<typeof buildApp>>;
  const call=(path:string,body:object={},token=teacherToken)=>app.inject({method:'POST',url:'/api/v1'+path,headers:auth(token),payload:body});
  async function setup(transport?:AiTransport,extra:NodeJS.ProcessEnv={}){
    const credentials=JSON.parse(testConfig().AUTH_CREDENTIALS_JSON);credentials.push({token:otherToken,role:'teacher',actorId:'other-teacher'});
    const config=testConfig({AUTH_CREDENTIALS_JSON:JSON.stringify(credentials),...(transport?{AI_MOCK_MODE:'false',GEMINI_API_KEY:'test-key-never-sent',AI_PRIMARY_INPUT_USD_PER_MILLION:'1',AI_PRIMARY_OUTPUT_USD_PER_MILLION:'2',AI_MAX_RETRIES:'0'}:{}),...extra});
    app=await buildApp({db:fixture.db,config,transport});
  }
  async function student(teacherId='teacher-test'){
    const token=crypto.randomUUID()+crypto.randomUUID();const s=await fixture.db.student.create({data:{tokenHash:hash(token),mode:'adaptive',experimentGroup:'private_group',teacherId,displayName:'Private Student Name',className:'PRIVATE_CLASS'}});return {...s,token};
  }
  async function attempt(s:{id:string},correct:boolean|null=true){
    let q=await fixture.db.question.findFirst();if(!q)q=(await call('/questions',grammarExamples[0]!)).json().question;
    const decision=await fixture.db.selectionDecision.create({data:{studentId:s.id,questionId:q!.id,mode:'adaptive',algorithm:'test',reason:'{}'}});
    return fixture.db.attempt.create({data:{studentId:s.id,questionId:q!.id,decisionId:decision.id,answer:'RAW_PRIVATE_LEARNER_ANSWER',correct,errorCode:correct===false?'E01':null,diagnosis:'{}',gradingSource:correct===null?'pending_teacher_review':'stored_option_key',mode:'adaptive'}});
  }
  beforeEach(async()=>{fixture=await testDb();});afterEach(async()=>{if(app)await app.close();await fixture.cleanup();});
  it('requires the appropriate role and never accepts fabricated progress',async()=>{
    await setup();const s=await student();
    expect((await call('/ai/study-plan',{days:3,minutesPerDay:10,correct:100},s.token)).statusCode).toBe(400);
    expect((await call('/ai/study-plan',{days:3,minutesPerDay:10})).statusCode).toBe(403);
    expect((await call('/ai/lesson-plan',{tense:'present_simple',difficulty:1,minutes:30},s.token)).statusCode).toBe(403);
    expect((await call('/ai/class-insights',{},s.token)).statusCode).toBe(403);
    expect((await app.inject({url:'/api/v1/ai/support/history?kind=study_plan',headers:auth(adminToken)})).statusCode).toBe(403);
    expect((await call('/ai/study-plan',{days:5,minutesPerDay:10},s.token)).statusCode).toBe(400);
  });
  it('returns a labelled starter plan without inventing prior results, reuses it and deletes personal cache with the student',async()=>{
    await setup();const s=await student();
    const first=await call('/ai/study-plan',{days:3,minutesPerDay:10},s.token);expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({provenance:'mock',cached:false,context:{basis:'starter_plan',statistics:{confirmed:0,pending:0}}});expect(first.json().data.days).toHaveLength(3);
    expect((await call('/ai/study-plan',{days:3,minutesPerDay:10},s.token)).json().cached).toBe(true);expect(await fixture.db.aiUsage.count()).toBe(1);
    expect((await app.inject({url:'/api/v1/ai/support/history?kind=study_plan',headers:auth(s.token)})).json().items).toHaveLength(1);
    const another=await student();expect((await app.inject({url:'/api/v1/ai/support/history?kind=study_plan',headers:auth(another.token)})).json().items).toEqual([]);
    await fixture.db.student.delete({where:{id:s.id}});expect(await fixture.db.aiSupportCache.count()).toBe(0);
  });
  it('uses real counters, excludes pending from errors and refreshes the plan after progress changes',async()=>{
    await setup();const s=await student();await attempt(s,true);await attempt(s,null);
    const first=(await call('/ai/study-plan',{days:7,minutesPerDay:15},s.token)).json();
    expect(first.context.statistics).toMatchObject({windowAttempts:2,confirmed:1,correct:1,pending:1});expect(first.data.days.map((d:{day:number})=>d.day)).toEqual([1,2,3,4,5,6,7]);
    expect(first.data.summaryVi).toContain('1 câu đã chấm (1 đúng)');
    await attempt(s,false);const fresh=(await call('/ai/study-plan',{days:7,minutesPerDay:15},s.token)).json();expect(fresh.cached).toBe(false);expect(fresh.context.statistics.byTense[0].errors).toEqual([{code:'E01',count:1}]);
  });
  it('refuses to explain unanswered decisions or another learner attempt, and keeps raw answers/identity out of Gemini',async()=>{
    const transport={call:vi.fn().mockResolvedValue({text:JSON.stringify(explanation),inputTokens:50,outputTokens:80})};await setup(transport);
    const s=await student(),other=await student();const a=await attempt(s,null);
    expect((await call('/ai/answer-explanation',{attemptId:crypto.randomUUID()},s.token)).statusCode).toBe(404);
    expect((await call('/ai/answer-explanation',{attemptId:a.id},other.token)).statusCode).toBe(404);expect(transport.call).not.toHaveBeenCalled();
    const result=await call('/ai/answer-explanation',{attemptId:a.id},s.token);expect(result.statusCode).toBe(200);expect(result.json().provenance).toBe('gemini');
    const prompt=transport.call.mock.calls[0]![1] as string;
    for(const secret of [s.id,s.token,'Private Student Name','PRIVATE_CLASS','RAW_PRIVATE_LEARNER_ANSWER','private_group'])expect(prompt).not.toContain(secret);
    expect(prompt).toContain('"correct":null');expect((await fixture.db.attempt.findUniqueOrThrow({where:{id:a.id}})).correct).toBeNull();
    expect((await call('/ai/answer-explanation',{attemptId:a.id},s.token)).json().cached).toBe(true);expect(transport.call).toHaveBeenCalledTimes(1);
  });
  it('scopes teacher insights to assigned students, keeps staff history separate and gives admins global data',async()=>{
    await setup();const a=await student(),b=await student('other-teacher');await attempt(a,false);await attempt(b,true);await attempt(b,true);
    const own=(await call('/ai/class-insights')).json();expect(own.context.statistics).toMatchObject({registeredStudents:1,windowAttempts:1,correct:0});
    const other=(await call('/ai/class-insights',{},otherToken)).json();expect(other.context.statistics).toMatchObject({registeredStudents:1,windowAttempts:2,correct:2});
    expect((await call('/ai/class-insights',{},adminToken)).json().context.statistics.windowAttempts).toBe(3);
    await fixture.db.student.update({where:{id:a.id},data:{teacherId:'other-teacher'}});
    expect((await call('/ai/class-insights')).statusCode).toBe(422);
    // Stored insight contains only anonymous aggregate counts, never student data.
    const history=(await app.inject({url:'/api/v1/ai/support/history?kind=class_insights',headers:auth(teacherToken)})).body;
    expect(history).not.toContain(a.id);expect(history).not.toContain('Private Student Name');
  });
  it('does not spend or fabricate insights when no confirmed answers exist',async()=>{
    const transport={call:vi.fn()};await setup(transport);const s=await student();await attempt(s,null);
    const r=await call('/ai/class-insights');expect(r.statusCode).toBe(422);expect(r.json().error).toBe('INSUFFICIENT_LEARNING_DATA');expect(transport.call).not.toHaveBeenCalled();expect(await fixture.db.aiUsage.count()).toBe(0);
  });
  it('separates teacher and administrator history even when credentials share an actor ID',async()=>{
    await setup(undefined,{AUTH_CREDENTIALS_JSON:JSON.stringify([{token:teacherToken,role:'teacher',actorId:'teacher-test'},{token:adminToken,role:'admin',actorId:'teacher-test'}])});
    const a=await student(),b=await student('other-teacher');await attempt(a,true);await attempt(b,false);
    await call('/ai/class-insights');await call('/ai/class-insights',{},adminToken);
    const history=async(token:string)=>(await app.inject({url:'/api/v1/ai/support/history?kind=class_insights',headers:auth(token)})).json().items;
    expect((await history(teacherToken)).map((r:{context:{statistics:{windowAttempts:number}}})=>r.context.statistics.windowAttempts)).toEqual([1]);
    expect((await history(adminToken)).map((r:{context:{statistics:{windowAttempts:number}}})=>r.context.statistics.windowAttempts)).toEqual([2]);
  });
  it('generates a correctly timed lesson without publishing questions or assigning exercises',async()=>{
    await setup();const r=await call('/ai/lesson-plan',{tense:'past_simple',difficulty:2,minutes:45,focusError:'E04'});expect(r.statusCode).toBe(200);expect(r.json().data.activities.reduce((n:number,a:{minutes:number})=>n+a.minutes,0)).toBe(45);
    expect(await fixture.db.question.count()).toBe(0);expect(await fixture.db.exercise.count()).toBe(0);expect((await call('/ai/lesson-plan',{tense:'past_simple',difficulty:2,minutes:45,focusError:'E04'})).json().cached).toBe(true);
    expect((await app.inject({url:'/api/v1/ai/support/history?kind=lesson_plan',headers:auth(otherToken)})).json().items).toEqual([]);
  });
  it('rejects structurally valid but unusable AI durations, day sequences and invented error priorities',async()=>{
    await setup();const mockLesson=(await call('/ai/lesson-plan',{tense:'past_simple',difficulty:1,minutes:30})).json().data;
    const s=await student();const mockPlan=(await call('/ai/study-plan',{days:3,minutesPerDay:10},s.token)).json().data;
    await app.close();const transport={call:vi.fn().mockResolvedValueOnce({text:JSON.stringify({...mockLesson,activities:mockLesson.activities.map((a:object)=>({...a,minutes:1}))})}).mockResolvedValueOnce({text:JSON.stringify({...mockPlan,days:mockPlan.days.slice(0,2).concat(mockPlan.days[0])})})};await setup(transport);
    expect((await call('/ai/lesson-plan',{tense:'present_continuous',difficulty:1,minutes:30})).statusCode).toBe(502);
    expect((await call('/ai/study-plan',{days:3,minutesPerDay:15},s.token)).statusCode).toBe(502);
    await attempt(s,false);
    transport.call.mockResolvedValueOnce({text:JSON.stringify({summaryVi:'Cần ôn điểm ngữ pháp đã ghi nhận.',priorities:[{tense:'present_simple',errorCode:'E02',reasonVi:'Lỗi này chưa có trong dữ liệu.',teachingActionVi:'Cần kiểm tra dữ liệu trước khi gợi ý.'}],nextLessonVi:'Xem lại kết quả của học sinh.'})});
    expect((await call('/ai/class-insights')).statusCode).toBe(502);
    expect(await fixture.db.aiSupportCache.count()).toBe(2);
  });
  it('surfaces provider/budget errors without inventing a successful AI result',async()=>{
    await setup({call:vi.fn().mockRejectedValue({status:503})});const r=await call('/ai/lesson-plan',{tense:'past_simple',difficulty:1,minutes:30});expect(r.statusCode).toBe(503);expect(await fixture.db.aiSupportCache.count()).toBe(0);
    await app.close();await setup({call:vi.fn()},{AI_DAILY_BUDGET_USD:'0'});expect((await call('/ai/lesson-plan',{tense:'past_simple',difficulty:1,minutes:30})).statusCode).toBe(429);
  });
  it('coalesces concurrent paid calls for the same request and regenerates expired or corrupt saved data',async()=>{
    await setup();const mock=(await call('/ai/lesson-plan',{tense:'past_simple',difficulty:1,minutes:30})).json().data;await app.close();
    let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
    const transport={call:vi.fn().mockImplementation(async()=>{await gate;return {text:JSON.stringify(mock),inputTokens:10,outputTokens:10};})};await setup(transport);
    const input={tense:'present_simple',difficulty:1,minutes:30};const pending=[call('/ai/lesson-plan',input),call('/ai/lesson-plan',input)].map(r=>r.then(r=>r));
    await vi.waitFor(()=>expect(transport.call).toHaveBeenCalledTimes(1));release();
    expect((await Promise.all(pending)).every(r=>r.statusCode===200)).toBe(true);expect(transport.call).toHaveBeenCalledTimes(1);
    await fixture.db.aiSupportCache.updateMany({where:{provenance:'gemini'},data:{createdAt:new Date(0)}});
    expect((await call('/ai/lesson-plan',input)).json().cached).toBe(false);expect(transport.call).toHaveBeenCalledTimes(2);
    await fixture.db.aiSupportCache.updateMany({where:{provenance:'gemini'},data:{result:'invalid json'}});
    expect((await call('/ai/lesson-plan',input)).statusCode).toBe(200);expect(transport.call).toHaveBeenCalledTimes(3);
  });
});
