// @vitest-environment node
import { describe,it,expect,vi } from 'vitest';
import { buildApp } from '../../src/app';
import { testDb,testConfig,adminToken,teacherToken } from '../../tests/helpers';
import { ApiClient } from './services/api';
describe('browser API client against the actual Fastify services and SQLite',()=>{
  it('generates mock drafts, reviews, provisions, assigns, grades tokens, recovers results and exports records',async()=>{
    const fixture=await testDb();const app=await buildApp({db:fixture.db,config:testConfig()});
    vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
      const response=await app.inject({method:(init?.method??'GET') as 'GET'|'POST',url:String(input),
        headers:Object.fromEntries(new Headers(init?.headers).entries()),payload:typeof init?.body==='string'?init.body:undefined});
      return new Response(response.statusCode===204?null:response.body,{status:response.statusCode,headers:{'Content-Type':'application/json'}});
    });
    try{
      const teacher=new ApiClient(teacherToken);const admin=new ApiClient(adminToken);
      expect(await teacher.session()).toMatchObject({role:'teacher'});
      const {questions}=await teacher.generate({tense:'present_simple',difficulty:1,questionType:'error_correction',count:1});
      expect(questions[0]).toMatchObject({status:'draft',provenance:'mock'});
      const q=questions[0]!;await admin.review(q.id,'approve','Simulated teacher review for isolated integration test');
      const account=await teacher.provision('adaptive','A');const student=new ApiClient(account.token);
      expect(await student.session()).toMatchObject({role:'student',actorId:account.id});
      const next=await student.next(account.id,{questionType:'error_correction',tense:'present_simple'});
      expect(next.question).not.toHaveProperty('correctAnswer');
      const tokens=[...next.question!.wordTokens!];
      const tokenIds=q.correctAnswer.split(/\s+/).map(word=>tokens.splice(tokens.findIndex(t=>t.text===word),1)[0]!.id);
      expect(await student.submit(next.decisionId,{tokenIds})).toMatchObject({correct:true});
      expect(await student.submit(next.decisionId,{tokenIds})).toMatchObject({correct:true});
      expect(await student.summary(account.id)).toMatchObject({total:1,xp:10});
      expect((await teacher.students()).students).toEqual([expect.objectContaining({id:account.id,total:1,correct:1})]);
      expect((await teacher.learningReport()).rows).toHaveLength(1);
      const research=await admin.research();expect(research.rows).toHaveLength(1);expect(research.rows[0]).toMatchObject({correct:true,mode:'adaptive'});
      await teacher.studentName(account.id,'Classroom alias');
      const {lesson}=await teacher.createLesson({title:'Grammar lesson',heldOn:'2026-10-28',studentIds:[account.id]});
      expect((await teacher.lesson(lesson.id)).lesson.records[0].status).toBe('unmarked');
      expect((await teacher.markAttendance(lesson.id,[{studentId:account.id,status:'present'}])).lesson.records[0].status).toBe('present');
      const report=await teacher.saveLessonReport(lesson.id,{reportClassName:'Lớp 7',vocabularyTotal:15,records:[{studentId:account.id,homeworkStatus:'complete',vocabularyKnown:14,miniTestScore:5.5}]});
      expect(report.lesson.records[0]).toMatchObject({status:'present',vocabularyKnown:14,miniTestScore:5.5,reportedBy:'teacher-test'});
      expect((await teacher.lesson(lesson.id)).lesson.vocabularyTotal).toBe(15);
      const {exercise}=await teacher.saveExercise({title:'Assigned grammar',instructions:'Read carefully.',questionIds:[q.id],studentIds:[account.id]});
      expect((await student.exercises(0,true)).exercises).toHaveLength(0);
      await teacher.publishExercise(exercise.id);
      const assigned=await student.exerciseNext(exercise.id);
      expect(assigned.question).not.toHaveProperty('correctAnswer');
      expect(await student.submit(assigned.decisionId!,{answer:q.correctAnswer})).toMatchObject({correct:true});
      expect((await student.exerciseNext(exercise.id)).completed).toBe(true);
      expect((await teacher.exercise(exercise.id)).exercise.recipients[0]).toMatchObject({answered:1,correct:1,student:{displayName:'Classroom alias'}});
      const plan=await student.studyPlan(3,10);expect(plan.provenance).toBe('mock');expect(plan.data.days).toHaveLength(3);expect((await student.studyPlan(3,10)).cached).toBe(true);
      const submitted=(await student.summary(account.id)).attempts[0]!;
      expect((await student.explainAnswer(submitted.id)).data.stepsVi.length).toBeGreaterThan(1);
      expect((await teacher.lessonPlan({tense:'present_simple',difficulty:1,minutes:30,focusError:null})).data.activities.reduce((n,a)=>n+a.minutes,0)).toBe(30);
      expect((await teacher.classInsights()).context.statistics.confirmed).toBe(2);
      expect((await student.supportHistory('study_plan')).items).toHaveLength(1);
      await admin.request(`/learning/students/${account.id}`,{method:'DELETE'});
      expect((await teacher.students()).students).toHaveLength(0);
    }finally{vi.restoreAllMocks();await app.close();await fixture.cleanup();}
  },15000);
});
