import type {
  Assignment,
  BankQuestion,
  Feedback,
  GenerateRequest,
  QuestionType,
  ResearchRow,
  Session,
  Summary,
  Tense,
  QuestionDraft,
  ImportPreview,
  LessonSummary,LessonDetail,AttendanceStatus,ExerciseInput,ExerciseSummary,ExerciseDetail,ExerciseNext,
} from "../types";
import {
  demoBank,
  demoGenerate,
  demoNext,
  demoResearch,
  demoSubmit,
  demoSummary,
} from "./demo";
import type {StudyPlanResult,ExplanationResult,LessonPlanResult,LessonPlanInput,InsightsResult} from '../types-ai';
const messages: Record<string, string> = {
  INSUFFICIENT_LEARNING_DATA:'Chưa có câu trả lời đã chấm để AI nhận xét. Hãy cho học sinh làm bài trước; bạn vẫn có thể soạn giáo án.',
  INVALID_AI_OUTPUT:'AI trả về nội dung chưa đạt yêu cầu. Chưa có nội dung mới được lưu; hãy thử lại sau.',
  QUESTIONS_AWAITING_APPROVAL:'Có câu hỏi đang chờ quản trị viên duyệt. Bạn có thể lưu bản nháp và giao bài sau khi tất cả câu được duyệt.',
  EXERCISE_PUBLISHED:'Bài đã giao được giữ nguyên để bảo toàn kết quả học sinh. Hãy tạo bài mới nếu cần đổi nội dung.',
  QUESTION_NOT_APPROVED:'Câu hỏi này chưa sẵn sàng. Hãy báo giáo viên để kiểm tra lại bài tập.',
  INVALID_ROSTER:'Có học sinh không thuộc danh sách buổi học. Hãy tải lại danh sách.',
  SELF_REVIEW_FORBIDDEN: 'Cần một quản trị viên khác duyệt câu hỏi do bạn tạo.',
  INVALID_TEACHER: 'Giáo viên đã chọn không còn khả dụng. Hãy tải lại trang.',
  INVALID_QUESTION: 'Có câu cần sửa. Hãy kiểm tra lại đề bài, đáp án và giải thích trước khi lưu.',
  UNAUTHORIZED: "Mã truy cập không hợp lệ hoặc phiên đã kết thúc.",
  FORBIDDEN: "Tài khoản của bạn chưa có quyền thực hiện thao tác này.",
  AI_BUDGET_EXCEEDED:
    "Hạn mức AI hôm nay đã hết. Bạn vẫn có thể dùng kho câu đã duyệt.",
  AI_NOT_CONFIGURED: "Dịch vụ AI chưa sẵn sàng. Hãy liên hệ quản trị viên.",
  AI_UNAVAILABLE: "Dịch vụ AI đang bận. Vui lòng thử lại sau.",
  AI_PRICING_REQUIRED:
    "Quản trị viên cần kiểm tra cấu hình chi phí của dịch vụ AI.",
  AI_TIMEOUT: "AI phản hồi quá lâu. Vui lòng thử lại.",
  DUPLICATE_CONTENT:
    "Nội dung đã có trong kho. Hãy kiểm tra và tái sử dụng câu hiện có.",
  ALREADY_SUBMITTED: "Câu này đã được nộp. Hãy tiếp tục sang câu mới.",
  RATE_LIMITED: "Bạn thao tác hơi nhanh. Hãy đợi một phút rồi thử lại.",
  AI_RATE_LIMITED: "Dịch vụ AI đang giới hạn lượt gọi. Vui lòng thử lại sau.",
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export class ApiClient {
  constructor(
    private token: string,
    public demo = false,
  ) {}
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`/api/v1${path}`, {
        ...options,
        headers: {
          ...(options.body!==undefined?{"Content-Type": "application/json"}:{}),
          Authorization: `Bearer ${this.token}`,
          ...options.headers,
        },
      });
    } catch {
      throw new ApiError(
        0,
        "NETWORK_ERROR",
        "Không kết nối được máy chủ. Kiểm tra mạng và thử lại; câu trả lời của bạn vẫn được giữ.",
      );
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        body.error ?? "REQUEST_FAILED",
        messages[body.error] ??
          "Chưa thể hoàn tất thao tác. Hãy kiểm tra thông tin và thử lại.",
      );
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
  session() {
    return this.request<Session>("/auth/session");
  }
  health() {
    return this.demo
      ? Promise.resolve({ status: "ok", aiMode: "synthetic_demo" })
      : this.request<{ status: string; aiMode: string }>("/health");
  }
  summary(id: string) {
    return this.demo
      ? Promise.resolve(demoSummary())
      : this.request<Summary>(`/learning/students/${id}/summary`);
  }
  next(id: string, scope: { tense?: Tense; questionType?: QuestionType } = {}) {
    const search = new URLSearchParams(
      Object.entries(scope).filter(([, v]) => v),
    );
    return this.demo
      ? Promise.resolve(demoNext(scope))
      : this.request<Assignment>(
          `/learning/students/${id}/next-question?${search}`,
        );
  }
  async submit(
    decisionId: string,
    body: { answer?: string; tokenIds?: string[] },
  ): Promise<Feedback> {
    if (this.demo) return demoSubmit(decisionId, body);
    try {
      return await this.request<Feedback>("/learning/attempts", {
        method: "POST",
        body: JSON.stringify({ decisionId, ...body }),
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "ALREADY_SUBMITTED")
        return this.request<Feedback>(
          `/learning/assignments/${decisionId}/result`,
        );
      throw error;
    }
  }
  questions(query = "") {
    return this.demo
      ? Promise.resolve({ questions: [...demoBank] })
      : this.request<{ questions: BankQuestion[] }>(
          `/ai/questions?limit=100&${query}`,
        );
  }
  createQuestion(question:QuestionDraft) {
    if(this.demo)throw new ApiError(401,'REAL_ACCOUNT_REQUIRED','Đăng nhập bằng mã giáo viên để lưu câu hỏi vào kho thật.');
    return this.request<{question:BankQuestion}>('/questions',{method:'POST',body:JSON.stringify(question)});
  }
  previewImport(questions:unknown[]) {
    if(this.demo)throw new ApiError(401,'REAL_ACCOUNT_REQUIRED','Đăng nhập bằng mã giáo viên để nhập câu hỏi vào kho thật.');
    return this.request<ImportPreview>('/questions/import/preview',{method:'POST',body:JSON.stringify({questions})});
  }
  importQuestions(questions:unknown[],skipDuplicates:boolean) {
    if(this.demo)throw new ApiError(401,'REAL_ACCOUNT_REQUIRED','Đăng nhập bằng mã giáo viên để nhập câu hỏi vào kho thật.');
    return this.request<{questions:BankQuestion[];skipped:number}>('/questions/import',{method:'POST',body:JSON.stringify({questions,skipDuplicates})});
  }
  generate(body: GenerateRequest) {
    return this.demo
      ? Promise.resolve(demoGenerate(body))
      : this.request<{ questions: BankQuestion[] }>("/ai/questions/generate", {
          method: "POST",
          body: JSON.stringify(body),
        });
  }
  review(id: string, action: "approve" | "reject", note: string) {
    if (this.demo) {
      const q = demoBank.find((q) => q.id === id)!;
      q.status = action === "approve" ? "approved" : "rejected";
      return Promise.resolve(q);
    }
    return this.request<BankQuestion>(`/ai/questions/${id}/${action}`, {
      method: "POST",
      body: JSON.stringify({
        note,
        checkedGrammarAndAnswer: action === "approve",
      }),
    });
  }
  provision(mode: string, experimentGroup: string, teacherId?:string|null,displayName?:string,className?:string) {
    if (this.demo)
      return Promise.resolve({
        id: "demo-new-student",
        token: "DEMO-ONLY-NOT-A-REAL-CREDENTIAL",
        mode,
        experimentGroup,
      });
    return this.request<{
      id: string;
      token: string;
      mode: string;
      experimentGroup: string;
    }>("/learning/students", {
      method: "POST",
      body: JSON.stringify({ mode, experimentGroup, teacherId,displayName,className }),
    });
  }
  students(offset=0):Promise<{students:StudentRecord[];nextOffset:number|null}> {
    if(this.demo) return Promise.resolve({students:[{id:'demo-student',displayName:'Học sinh minh họa',className:'Lớp mẫu',mode:'adaptive',experimentGroup:'general',teacherId:'demo-teacher',createdAt:new Date().toISOString(),total:0,confirmed:0,correct:0}],nextOffset:null as number|null});
    return this.request<{students:StudentRecord[];nextOffset:number|null}>(`/learning/students?limit=100&offset=${offset}`);
  }
  teachers() {
    return this.demo?Promise.resolve({teachers:[{id:'demo-teacher',label:'Giáo viên minh họa'}]}):this.request<{teachers:{id:string;label:string}[]}>('/learning/teachers');
  }
  assignTeacher(id:string,teacherId:string|null) {
    if(this.demo)return Promise.resolve({id,teacherId});
    return this.request<{id:string;teacherId:string|null}>(`/learning/students/${id}/teacher`,{method:'PATCH',body:JSON.stringify({teacherId})});
  }
  private classroomAccount(){if(this.demo)throw new ApiError(401,'REAL_ACCOUNT_REQUIRED','Đăng nhập bằng mã thật để dùng sổ điểm danh và bài tập.');}
  studentName(id:string,displayName:string|null,className?:string|null){this.classroomAccount();return this.request(`/learning/students/${id}/profile`,{method:'PATCH',body:JSON.stringify({displayName,className})});}
  lessons(offset=0){if(this.demo)return Promise.resolve({lessons:[] as LessonSummary[],nextOffset:null as number|null});return this.request<{lessons:LessonSummary[];nextOffset:number|null}>(`/teaching/lessons?limit=30&offset=${offset}`);}
  createLesson(body:{title:string;heldOn:string;studentIds:string[]}){this.classroomAccount();return this.request<{lesson:LessonSummary}>('/teaching/lessons',{method:'POST',body:JSON.stringify(body)});}
  lesson(id:string){this.classroomAccount();return this.request<{lesson:LessonDetail}>(`/teaching/lessons/${id}`);}
  markAttendance(id:string,records:{studentId:string;status:AttendanceStatus}[]){this.classroomAccount();return this.request<{lesson:LessonDetail}>(`/teaching/lessons/${id}/attendance`,{method:'PATCH',body:JSON.stringify({records})});}
  exercises(offset=0,student=false){if(this.demo)return Promise.resolve({exercises:[] as ExerciseSummary[],nextOffset:null as number|null});return this.request<{exercises:ExerciseSummary[];nextOffset:number|null}>(`/${student?'learning':'teaching'}/exercises?limit=30&offset=${offset}`);}
  exercise(id:string){this.classroomAccount();return this.request<{exercise:ExerciseDetail}>(`/teaching/exercises/${id}`);}
  saveExercise(body:ExerciseInput,id?:string){this.classroomAccount();return this.request<{exercise:ExerciseSummary}>(`/teaching/exercises${id?'/'+id:''}`,{method:id?'PATCH':'POST',body:JSON.stringify(body)});}
  publishExercise(id:string){this.classroomAccount();return this.request(`/teaching/exercises/${id}/publish`,{method:'POST'});}
  exerciseNext(id:string){this.classroomAccount();return this.request<ExerciseNext>(`/learning/exercises/${id}/next-question`);}
  studyPlan(days:3|7,minutesPerDay:number){this.classroomAccount();return this.request<StudyPlanResult>('/ai/study-plan',{method:'POST',body:JSON.stringify({days,minutesPerDay})});}
  explainAnswer(attemptId:string){this.classroomAccount();return this.request<ExplanationResult>('/ai/answer-explanation',{method:'POST',body:JSON.stringify({attemptId})});}
  lessonPlan(body:LessonPlanInput){this.classroomAccount();return this.request<LessonPlanResult>('/ai/lesson-plan',{method:'POST',body:JSON.stringify(body)});}
  classInsights(){this.classroomAccount();return this.request<InsightsResult>('/ai/class-insights',{method:'POST',body:'{}'});}
  supportHistory<K extends 'study_plan'|'lesson_plan'|'class_insights'>(kind:K):Promise<{items:({study_plan:StudyPlanResult;lesson_plan:LessonPlanResult;class_insights:InsightsResult})[K][]}>{return this.demo?Promise.resolve({items:[]}):this.request(`/ai/support/history?kind=${kind}`);}
  learningReport() { return this.report('/learning/reports'); }
  research() { return this.report('/research/export'); }
  private async report(path:string): Promise<{ rows: ResearchRow[]; truncated: boolean }> {
    if (this.demo) return { rows: demoResearch(), truncated: false };
    const rows: ResearchRow[] = [];
    for (let offset = 0; offset < 10000; offset += 1000) {
      const page = await this.request<{
        rows: ResearchRow[];
        nextOffset: number | null;
      }>(`${path}?format=json&limit=1000&offset=${offset}`);
      rows.push(...page.rows);
      if (page.nextOffset === null) return { rows, truncated: false };
    }
    return { rows, truncated: true };
  }
}
export interface StudentRecord {
  id:string;mode:string;experimentGroup:string;teacherId:string|null;createdAt:string;
  total:number;confirmed:number;correct:number;
  displayName?:string|null;
  className?:string|null;
}
