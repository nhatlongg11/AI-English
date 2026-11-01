import { Component, Suspense, lazy, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes, Link } from "react-router-dom";
import { useAuth } from "./features/auth/context";
import { Login } from "./features/auth/Login";
import { Shell } from "./components/layout/Shell";
import {
  Brand,
  EmptyState,
  Loading,
  Notice,
  PageHeading,
} from "./components/common";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import type { Role } from "./types";
const StudentDashboard = lazy(() =>
  import("./features/student/Dashboard").then((m) => ({
    default: m.StudentDashboard,
  })),
);
const GrammarLibrary = lazy(() =>
  import("./features/student/Grammar").then((m) => ({
    default: m.GrammarLibrary,
  })),
);
const GrammarTopic = lazy(() =>
  import("./features/student/Grammar").then((m) => ({
    default: m.GrammarTopic,
  })),
);
const StudentProgress = lazy(() =>
  import("./features/student/Progress").then((m) => ({
    default: m.StudentProgress,
  })),
);
const Practice = lazy(() =>
  import("./features/learning/Practice").then((m) => ({ default: m.Practice })),
);
const PracticeResult = lazy(() =>
  import("./features/learning/Practice").then((m) => ({
    default: m.PracticeResult,
  })),
);
const TeacherDashboard = lazy(() =>
  import("./features/teacher/Dashboard").then((m) => ({
    default: m.TeacherDashboard,
  })),
);
const QuestionBank = lazy(() =>
  import("./features/teacher/QuestionBank").then((m) => ({
    default: m.QuestionBank,
  })),
);
const AIStudio = lazy(() =>
  import("./features/teacher/AIStudio").then((m) => ({ default: m.AIStudio })),
);
const Students = lazy(() =>
  import("./features/teacher/Students").then((m) => ({ default: m.Students })),
);
const Attendance=lazy(()=>import('./features/teacher/Attendance').then(m=>({default:m.Attendance})));
const StudyCoach=lazy(()=>import('./features/ai/StudyCoach').then(m=>({default:m.StudyCoach})));
const TeacherAiTools=lazy(()=>import('./features/ai/TeacherTools').then(m=>({default:m.TeacherAiTools})));
const Exercises=lazy(()=>import('./features/teacher/Exercises').then(m=>({default:m.Exercises})));
const AssignedExercises=lazy(()=>import('./features/learning/AssignedExercises').then(m=>({default:m.AssignedExercises})));
const AssignedExercisePlayer=lazy(()=>import('./features/learning/AssignedExercises').then(m=>({default:m.AssignedExercisePlayer})));
const ResearchDashboard = lazy(() =>
  import("./features/research/Research").then((m) => ({
    default: m.ResearchDashboard,
  })),
);
export function Protected({ roles }: { roles?: Role[] }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(session.role))
    return (
      <Navigate
        to={
          session.role === "student"
            ? "/student/dashboard"
            : "/teacher/dashboard"
        }
        replace
      />
    );
  return <Outlet />;
}
function Home() {
  const { session } = useAuth();
  return (
    <Navigate
      to={
        session
          ? session.role === "student"
            ? "/student/dashboard"
            : "/teacher/dashboard"
          : "/login"
      }
      replace
    />
  );
}
function Registration() {
  return (
    <div className="max-w-xl mx-auto px-6 py-12 stack">
      <Brand />
      <Card className="panel">
        <h1>Nhận mã truy cập</h1>
        <p className="muted">
          TenseLab hiện sử dụng tài khoản do nhà trường cấp. Hãy liên hệ giáo
          viên hoặc quản trị viên để nhận mã học sinh.
        </p>
        <Notice>
          Chưa hỗ trợ đăng ký email/mật khẩu. Mỗi mã truy cập được gắn với một
          hồ sơ học tập ẩn danh.
        </Notice>
        <Button asChild>
          <Link to="/login">Về trang đăng nhập</Link>
        </Button>
      </Card>
    </div>
  );
}
function Help() {
  const { session } = useAuth();
  return (
    <>
      <PageHeading
        title="Cùng làm quen với TenseLab"
        description="Một vài điều nhỏ để học vui và học đúng cách."
      />
      <Card className="panel mb-6">
        <h2>Muốn có người chỉ từng bước?</h2>
        <p className="muted">Mở trang bạn muốn tìm hiểu, rồi bấm <strong>Hướng dẫn</strong> ở góc trên. Bạn có thể xem lại, bỏ qua hoặc đóng bằng phím Esc bất cứ lúc nào.</p>
      </Card>
      <div className="two-col">
        <Card className="panel">
          <h2>Học sinh bắt đầu từ đâu?</h2>
          <ol className="list-clean">
            <li>Đọc công thức và ví dụ trong Khám phá ngữ pháp.</li>
            <li>
              Chọn Tense Challenge, Sentence Builder hoặc Grammar Detective.
            </li>
            <li>Nộp câu trả lời, đọc giải thích rồi tiếp tục câu mới.</li>
            <li>Theo dõi kỹ năng trong Tiến bộ của bạn.</li>
          </ol>
          <p className="small muted">
            Khi mất mạng, câu bạn nhập vẫn được giữ. Đợi kết nối trở lại rồi thử
            nộp lại. Lượt đã nộp sẽ không được tính hai lần.
          </p>
        </Card>
        <Card className="panel">
          <h2>Tài khoản của bạn</h2>
          <p>
            Vai trò:{" "}
            <strong>
              {session?.role === "student"
                ? "Học sinh"
                : session?.role === "admin"
                  ? "Quản trị viên"
                  : "Giáo viên"}
            </strong>
          </p>
          <p className="small muted break-all">ID: {session?.actorId}</p>
          <Notice>
            {session?.demo
              ? "Bạn đang khám phá giao diện mẫu. Kết quả ở đây không được lưu vào hồ sơ học thật."
              : "Phiên sử dụng mã truy cập hiện có. Không chia sẻ mã của bạn với người khác."}
          </Notice>
          <p className="small muted">
            TenseLab có thể chưa kết luận với một cách diễn đạt tự do khác đáp
            án. Kết quả sẽ chờ kiểm tra và không làm giảm mức thành thạo của bạn.
          </p>
        </Card>
      </div>
    </>
  );
}
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="error-boundary">
          <h1>Trang này cần được tải lại</h1>
          <p className="muted my-4">
            Dữ liệu học tập đã nộp vẫn được lưu trên máy chủ. Hãy thử tải lại
            giao diện.
          </p>
          <Button onClick={() => window.location.reload()}>
            Tải lại trang
          </Button>
        </div>
      );
    return this.props.children;
  }
}
export function App() {
  return (
    <AppErrorBoundary>
      <Suspense
        fallback={
          <div className="page">
            <Loading />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Registration />} />
          <Route element={<Protected />}>
            <Route element={<Shell />}>
              <Route element={<Protected roles={["student"]} />}>
                <Route
                  path="/student/dashboard"
                  element={<StudentDashboard />}
                />
                <Route path="/student/grammar" element={<GrammarLibrary />} />
                <Route
                  path="/student/grammar/:tense"
                  element={<GrammarTopic />}
                />
                <Route path="/student/practice" element={<Practice />} />
                <Route
                  path="/student/practice/result"
                  element={<PracticeResult />}
                />
                <Route path="/student/progress" element={<StudentProgress />} />
                <Route path="/student/exercises" element={<AssignedExercises/>}/>
                <Route path="/student/ai-coach" element={<StudyCoach/>}/>
                <Route path="/student/exercises/:id" element={<AssignedExercisePlayer/>}/>
              </Route>
              <Route element={<Protected roles={["teacher", "admin"]} />}>
                <Route
                  path="/teacher/dashboard"
                  element={<TeacherDashboard />}
                />
                <Route path="/teacher/students" element={<Students />} />
                <Route path="/teacher/attendance" element={<Attendance/>}/>
                <Route path="/teacher/ai-tools" element={<TeacherAiTools/>}/>
                <Route path="/teacher/exercises" element={<Exercises/>}/>
                <Route
                  path="/teacher/question-bank"
                  element={<QuestionBank />}
                />
                <Route path="/teacher/ai-studio" element={<AIStudio />} />
                <Route
                  path="/teacher/analytics"
                  element={<ResearchDashboard analytics />}
                />
              </Route>
              <Route element={<Protected roles={["admin"]} />}>
                <Route
                  path="/research/dashboard"
                  element={<ResearchDashboard />}
                />
              </Route>
              <Route path="/help" element={<Help />} />
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <div className="page">
                <EmptyState
                  title="Trang này chưa có trên hành trình"
                  description="Quay lại góc học tập để tiếp tục nhé."
                  action={
                    <Button asChild>
                      <Link to="/">Về trang chính</Link>
                    </Button>
                  }
                />
              </div>
            }
          />
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  );
}
