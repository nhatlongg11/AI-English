import { Link } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Flame,
  Target,
  TrendingUp,
  Zap,
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
import { Progress } from "../../components/ui/progress";
import { AccuracyChart } from "../../components/charts/LearningCharts";
import { topics } from "../../lib/grammar";
import { formatDate, percent } from "../../lib/utils";
import type { Summary } from "../../types";
export function TopicCards({ summary }: { summary?: Summary }) {
  return (
    <div className="topic-grid">
      {topics.map((t) => {
        const skills = summary?.skills.filter((s) => s.tense === t.id) ?? [];
        const mastery = skills.length
          ? skills.reduce((n, s) => n + s.mastery, 0) / skills.length
          : 0;
        const count = summary?.available
          .filter((a) => a.tense === t.id)
          .reduce((n, a) => n + a._count, 0);
        return (
          <Link to={`/student/grammar/${t.id}`} key={t.id}>
            <Card className="topic-card">
              <div className={`topic-icon tone-${t.color}`}>{t.symbol}</div>
              <h3>{t.name}</h3>
              <p>
                {t.vi} · {t.tag}
              </p>
              <div className="progress-caption">
                <span>
                  {skills.length ? "Mức thành thạo" : "Sẵn sàng khám phá"}
                </span>
                <strong>{skills.length ? percent(mastery) : "Chưa học"}</strong>
              </div>
              <Progress value={mastery * 100} className="h-1.5" />
              <div className="topic-action">
                <span>
                  {count === undefined
                    ? "Khám phá bài học"
                    : count
                      ? `${count} câu hỏi sẵn sàng`
                      : "Đang bổ sung bài tập"}
                </span>
                <ArrowRight size={16} />
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
export function StudentDashboard() {
  const { session, api } = useAuth();
  const resource = useResource(`summary:${session!.actorId}`, () =>
    api.summary(session!.actorId),
  );
  if (resource.loading) return <Loading />;
  if (resource.error || !resource.data)
    return (
      <ResourceError
        message={resource.error ?? "Không có dữ liệu."}
        retry={resource.reload}
      />
    );
  const s = resource.data;
  const accuracy = s.confirmed ? s.correct / s.confirmed : 0;
  const mastered = s.skills.filter((s) => s.mastery >= 0.8).length;
  const practiceDays = new Set(
    s.attempts.map((a) =>
      new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" }).format(
        new Date(a.createdAt),
      ),
    ),
  ).size;
  return (
    <>
      <PageHeading
        title={
          session?.demo
            ? "Chào Minh Anh (mẫu) 👋"
            : "Chào bạn, cùng học nhé! 👋"
        }
        description="Một ngày mới, một cơ hội để giỏi hơn chính mình hôm qua."
        action={
          <Badge variant="outline" className="py-2 px-3 hidden sm:flex">
            <Flame size={14} className="mr-1 text-amber-600" />
            {practiceDays} ngày đã học
          </Badge>
        }
      />
      <Card className="panel mb-5 flex flex-wrap justify-between items-center gap-3"><div><h2>Có bài thầy cô giao?</h2><p className="small muted">Mở danh sách để làm bài mới hoặc tiếp tục bài đang làm.</p></div><Button asChild variant="outline"><Link to="/student/exercises">Bài thầy cô giao</Link></Button></Card>
      <Card className="panel mb-5 flex flex-wrap justify-between items-center gap-3"><div><h2>Hôm nay nên ôn gì?</h2><p className="small muted">Nhờ AI gợi ý kế hoạch ngắn từ những bài bạn đã làm.</p></div><Button asChild variant="outline"><Link to="/student/ai-coach">Lập kế hoạch cùng AI</Link></Button></Card>
      <section className="hero">
        <div className="hero-copy">
          <Badge variant="secondary" className="bg-white/70 font-medium">
            <span className="w-1.5 h-1.5 bg-primary rounded-full mr-1.5" />
            BÀI HỌC DÀNH CHO BẠN
          </Badge>
          <h2>
            Từng bước nhỏ hôm nay.
            <br />
            Tự tin hơn mỗi ngày.
          </h2>
          <p>
            Luyện tập vừa sức, hiểu rõ lỗi sai. TenseLab luôn đồng hành trên
            hành trình của bạn.
          </p>
          <Button asChild>
            <Link to="/student/practice?adaptive=1">
              Tiếp tục học
              <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
        <PaperArt />
      </section>
      <div className="stats-grid" data-guide="student-stats">
        <Stat
          icon={<Zap />}
          value={s.xp.toLocaleString("vi-VN")}
          label="Điểm kinh nghiệm"
          tone="yellow"
        />
        <Stat
          icon={<Target />}
          value={s.confirmed ? percent(accuracy) : "—"}
          label="Độ chính xác"
          tone="lavender"
        />
        <Stat
          icon={<BookOpen />}
          value={s.total}
          label="Câu đã hoàn thành"
          tone="mint"
        />
        <Stat
          icon={<Award />}
          value={mastered}
          label="Kỹ năng thành thạo"
          tone="peach"
        />
      </div>
      <SectionHeading
        title="Khám phá ngữ pháp"
        to="/student/grammar"
        link="Tất cả bài học"
      />
      <TopicCards summary={s} />
      <div className="dashboard-bottom">
        <Card className="panel">
          <div className="panel-head">
            <div>
              <h3>Mỗi lần luyện, một bước tiến</h3>
              <p className="small muted mt-1">
                Độ chính xác từ các lượt đã chấm · tối đa 100 lượt gần nhất
              </p>
            </div>
            <TrendingUp size={19} className="text-primary" />
          </div>
          <AccuracyChart attempts={s.attempts} />
          <div className="small muted flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            Độ chính xác theo ngày
          </div>
        </Card>
        <Card className="panel">
          <div className="panel-head">
            <h3>Hoạt động gần đây</h3>
            <Link to="/student/progress" className="text-link">
              Xem thêm
              <ArrowRight size={14} />
            </Link>
          </div>
          {s.attempts.length ? (
            <div>
              {s.attempts.slice(0, 3).map((a) => (
                <div className="activity-row" key={a.id}>
                  <span
                    className={`activity-icon tone-${a.correct ? "mint" : "lavender"}`}
                  >
                    {a.correct ? <Check size={16} /> : <BookOpen size={16} />}
                  </span>
                  <div>
                    <h3 className="small">
                      {topics.find((t) => t.id === a.question.tense)?.name}
                    </h3>
                    <p className="muted">
                      {a.correct === null
                        ? "Đang chờ kiểm tra"
                        : a.correct
                          ? "Thêm một câu đúng!"
                          : "Đã tìm ra điều cần luyện"}
                    </p>
                  </div>
                  <span className="time">{formatDate(a.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Bước đầu tiên đang chờ bạn"
              description="Hoàn thành một thử thách để ghi lại tiến bộ đầu tiên."
            />
          )}
          <div className="achievement-list">
            <div className={`achievement ${s.total ? "" : "locked"}`}>
              <Zap />
              Bắt đầu hành trình
            </div>
            <div className={`achievement ${s.correct >= 10 ? "" : "locked"}`}>
              <CheckCircle2 />
              10 câu chính xác
            </div>
            <div className={`achievement ${mastered ? "" : "locked"}`}>
              <Award />
              Hiểu thật sâu
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
