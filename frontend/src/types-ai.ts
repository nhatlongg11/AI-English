import type {Tense} from './types.js';
export interface LearningSignals{
  availableAttempts:number;windowAttempts:number;windowLimit:number;registeredStudents:number;activeStudents:number;confirmed:number;correct:number;pending:number;
  byTense:{tense:string;attempts:number;confirmed:number;correct:number;errors:{code:string;count:number}[]}[];
  availableContent:{tense:string;count:number}[];
}
export interface AiResult<T,C=Record<string,unknown>>{data:T;context:C;model:string;provenance:string;createdAt:string;cached:boolean}
export interface StudyPlan{summaryVi:string;days:{day:number;tense:Tense;goalVi:string;activityVi:string}[];encouragementVi:string}
export type StudyPlanResult=AiResult<StudyPlan,{days:number;minutesPerDay:number;basis:string;statistics:LearningSignals}>;
export interface AnswerExplanation{ruleVi:string;stepsVi:string[];example:{sentence:string;meaningVi:string};encouragementVi:string}
export type ExplanationResult=AiResult<AnswerExplanation>;
export interface LessonPlan{titleVi:string;objectivesVi:string[];activities:{titleVi:string;minutes:number;instructionsVi:string}[];supportVi:string;extensionVi:string;assessmentVi:string}
export interface LessonPlanInput{tense:Tense;difficulty:number;minutes:30|45|60;focusError:string|null}
export type LessonPlanResult=AiResult<LessonPlan,LessonPlanInput>;
export interface ClassInsights{summaryVi:string;priorities:{tense:Tense;errorCode:string|null;reasonVi:string;teachingActionVi:string}[];nextLessonVi:string}
export type InsightsResult=AiResult<ClassInsights,{statistics:LearningSignals}>;
