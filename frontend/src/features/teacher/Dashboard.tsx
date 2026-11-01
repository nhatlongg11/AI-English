import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  LibraryBig,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/context";
import { useResource } from "../../hooks/use-resource";
import {
  EmptyState,
  Loading,
  PageHeading,
  PaperArt,
  ResourceError,
  SectionHeading,
  Stat,
} from "../../components/common";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { ChartPanel } from "../../components/charts/LearningCharts";
import { Progress } from "../../components/ui/progress";
import { topics } from "../../lib/grammar";
export function TeacherDashboard() {
  const { api, session } = useAuth();
  const bank = useResource("teacher-overview-bank", () => api.questions());
  if (bank.loading) return <Loading />;
  if (bank.error || !bank.data)
    return (
      <ResourceError
        message={bank.error ?? "Không tải được kho câu."}
        retry={bank.reload}
      />
    );
  const qs = bank.data.questions;
  const draft = qs.filter((q) => q.status === "draft").length;
  const approved = qs.filter((q) => q.status === "approved").length;
  return (
    <>
      <PageHeading
        title="Chào thầy cô, một ngày dạy tốt!"
        description="Chuẩn bị học liệu chất lượng và đồng hành cùng mỗi bước tiến của học sinh."
      />
      <div className="flex flex-wrap gap-3 mb-5"><Button asChild variant="outline"><Link to="/teacher/attendance">Điểm danh buổi học</Link></Button><Button asChild variant="outline"><Link to="/teacher/exercises">Tạo và giao bài tập</Link></Button><Button asChild variant="outline"><Link to="/teacher/ai-tools">Soạn giáo án và gợi ý ôn tập với AI</Link></Button></div>
      <div className="hero">
        <div className="hero-copy">
          <Badge variant="secondary" className="bg-white/70">
            TEACHING WITH A HUMAN TOUCH
          </Badge>
          <h2>
            AI hỗ trợ soạn câu.
            <br />
            Thầy cô truyền cảm hứng.
          </h2>
          <p>
            Từ mục tiêu kỹ năng đến câu hỏi có giải thích. Mọi nội dung đều qua
            sự kiểm duyệt của quản trị viên.
          </p>
          <Button asChild>
            <Link to="/teacher/ai-studio">
              <Sparkles size={16} />
              Tạo học liệu mới
              <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
        <PaperArt />
      </div>
      <div className="stats-grid" data-guide="teacher-stats">
        <Stat
          icon={<LibraryBig />}
          value={qs.length}
          label="Câu trong trang kho mới nhất"
        />
        <Stat
          icon={<Clock3 />}
          value={draft}
          label="Câu chờ duyệt · trang này"
          tone="yellow"
        />
        <Stat
          icon={<CheckCircle2 />}
          value={approved}
          label="Câu đã xuất bản · trang này"
          tone="mint"
        />
        <Stat
          icon={<Users />}
          value={topics.filter(t => qs.some(q => q.tense === t.id && q.status === 'approved')).length}
          label="Chủ đề có bài đã duyệt"
          tone="peach"
        />
      </div>
      <SectionHeading
        title="Chuẩn bị cho buổi học tới"
        to="/teacher/question-bank"
        link="Mở ngân hàng câu hỏi"
      />
      <div className="topic-grid">
        {topics.map((t) => {
          const count = qs.filter(
            (q) => q.tense === t.id && q.status === "approved",
          ).length;
          const all = qs.filter((q) => q.tense === t.id).length;
          return (
            <Card key={t.id} className="topic-card">
              <div className={`topic-icon tone-${t.color}`}>{t.symbol}</div>
              <h3>{t.name}</h3>
              <p>
                {count} câu đã duyệt / {all} câu trong trang
              </p>
              <Progress
                value={all ? (count / all) * 100 : 0}
                className="h-1.5"
              />
              <Link className="topic-action" to="/teacher/question-bank">
                Xem & quản lý
                <ArrowRight size={16} />
              </Link>
            </Card>
          );
        })}
      </div>
      <div className="dashboard-bottom">
        <ChartPanel
          title="Đồng hành cùng học sinh"
          subtitle="Từ mã đăng nhập đầu tiên đến những bài đã hoàn thành"
        >
          <EmptyState
            title={session?.role === 'admin' ? 'Giúp các em bắt đầu luyện tập' : 'Chuẩn bị bài, sẵn sàng cho học sinh'}
            description="Tạo mã đăng nhập riêng cho mỗi em. Sau khi các em làm bài, bạn có thể xem kết quả trong Phân tích học tập."
            action={
              <Button asChild variant="outline">
                <Link to="/teacher/students">
                  Học sinh
                  <ArrowRight size={15} />
                </Link>
              </Button>
            }
          />
        </ChartPanel>
        <Card className="panel">
          <h3>Việc cần làm</h3>
          <div className="detail-box">
            <h3>
              {draft
                ? `${draft} câu chờ quản trị viên duyệt`
                : "Kho câu đã sẵn sàng cho bước tiếp theo"}
            </h3>
            <p className="small muted">
              Đọc đề bài, đáp án và giải thích. Hãy chắc rằng câu hỏi rõ ràng,
              vừa sức và có một đáp án phù hợp. Quản trị viên sẽ duyệt để xuất bản.
            </p>
            <Button asChild variant="link" className="px-0">
              <Link to="/teacher/question-bank">
                Mở hàng chờ duyệt
                <ArrowRight size={14} />
              </Link>
            </Button>
          </div>
          <p className="small muted">
            {session?.role === "admin"
              ? "Quản trị viên có thể xem nhật ký ẩn danh trong mục Nghiên cứu & đánh giá."
              : "Bạn có thể tạo mã và xem báo cáo cho học sinh mình phụ trách."}
          </p>
        </Card>
      </div>
    </>
  );
}
