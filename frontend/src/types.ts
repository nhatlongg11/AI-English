export type Role = "student" | "teacher" | "admin";
export type AttendanceStatus='unmarked'|'present'|'absent'|'late'|'excused';
export interface ClassroomStudent {id:string;displayName:string|null;className?:string|null;teacherId:string|null}
export interface LessonSummary {id:string;title:string;heldOn:string;createdBy:string;createdAt:string;total:number;marked:number}
export interface LessonDetail extends LessonSummary {records:{studentId:string;status:AttendanceStatus;markedAt:string|null;markedBy:string|null;student:ClassroomStudent}[]}
export interface ExerciseInput {title:string;instructions:string;questionIds:string[];studentIds:string[]}
export interface ExerciseSummary {id:string;title:string;instructions:string;publishedAt:string|null;questionCount:number;studentCount?:number;answered?:number;correct?:number;pending?:number}
export interface ExerciseDetail extends ExerciseSummary {questions:{questionId:string;position:number;question:BankQuestion}[];recipients:{studentId:string;student:ClassroomStudent;answered:number;correct:number;pending:number}[]}
export interface ExerciseNext {question:PublicQuestion|null;decisionId?:string;completed:boolean;exercise:{id:string;title:string;instructions:string;total:number;answered:number};reason?:Assignment['reason'];generationNeeded?:unknown}
export type Tense = "present_simple" | "present_continuous" | "past_simple";
export type QuestionType =
  | "multiple_choice"
  | "fill_in_blank"
  | "error_correction";
export type Game = "challenge" | "builder" | "detective";
export interface Session {
  role: Role;
  actorId: string;
  mode?: string;
  experimentGroup?: string;
  demo?: boolean;
}
export interface WordToken {
  id: string;
  text: string;
}
export interface PublicQuestion {
  id: string;
  tense: Tense;
  difficulty: number;
  questionType: QuestionType;
  content: string;
  options: string[];
  provenance: string;
  model: string;
  generatedAt: string;
  wordTokens?: WordToken[];
}
export interface BankQuestion extends Omit<PublicQuestion, "options"> {
  options: { text: string; errorCode: string | null }[];
  correctAnswer: string;
  explanationVi: string;
  grammarRule: string;
  errorCode: string;
  status: "draft" | "approved" | "rejected";
  reviewedBy: string | null;
  reviewFlags: string;
  createdBy?: string | null;
}
export type QuestionDraft = Pick<BankQuestion,'tense'|'difficulty'|'questionType'|'content'|'options'|'correctAnswer'|'explanationVi'|'grammarRule'|'errorCode'>;
export type ReviewAction = 'approve'|'reject';
export interface BulkReviewFilters {tense?:Tense;search?:string}
export interface BulkReviewPreview {ids:string[];matched:number;skippedOwn:number}
export interface BulkReviewResult {reviewed:number;status:'approved'|'rejected'}
export interface ImportPreview {
  rows: {row:number;content:string;valid:boolean;duplicate:'bank'|'file'|null;errors:string[]}[];
  invalidCount:number;
  duplicateCount:number;
  readyCount:number;
}
export interface Assignment {
  decisionId: string;
  question: PublicQuestion | null;
  reason: { skillId?: string; mode?: string; fallback?: boolean };
  generationNeeded: unknown;
}
export interface Feedback {
  attemptId: string;
  correct: boolean | null;
  correctAnswer: string;
  explanationVi: string;
  requiresTeacherReview: boolean;
  diagnosis: {
    status: string;
    correctedSentence: string | null;
    errorCodes: string[];
    explanationVi: string;
    source: string;
    provenance: string;
  };
  mastery: { mastery: number };
  gradingSource: string;
}
export interface Skill {
  id?: string;
  skillId: string;
  tense: Tense;
  errorCode: string;
  attempts: number;
  recentAccuracy: number;
  mastery: number;
  recentErrors: number;
  difficulty: number;
  lastPracticedAt: string;
}
export interface Activity {
  id: string;
  correct: boolean | null;
  errorCode: string | null;
  createdAt: string;
  mode: string;
  question: { tense: Tense; content: string };
}
export interface Summary {
  skills: Skill[];
  attempts: Activity[];
  total: number;
  confirmed: number;
  correct: number;
  xp: number;
  available: { tense: Tense; questionType: QuestionType; _count: number }[];
  activityWindow: number;
}
export interface ResearchRow {
  attemptId: string;
  anonymousStudentId: string;
  questionId: string;
  tense: Tense;
  skillId: string;
  correct: boolean | null;
  errorCode: string | null;
  createdAt: string;
  mode: string;
  experimentGroup: string;
  gradingSource: string;
  algorithm: string;
  reason: string;
  answerHash: string;
  provenance: string;
}
export interface GenerateRequest {
  tense: Tense;
  difficulty: number;
  questionType: QuestionType;
  count: number;
  targetErrorCode?: string;
  vocabularyTheme?: string;
  modelTier?: "primary" | "advanced";
}
export interface SessionResult {
  levelBefore?: number;
  levelAfter?: number;
  answers: number;
  correct: number;
  pending: number;
  xp: number;
  game: Game;
}
