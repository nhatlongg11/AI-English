import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";
import { PageHeading, Tip } from "../../components/common";
import { TopicCards } from "./Dashboard";
import { topics } from "../../lib/grammar";
import { useAuth } from "../auth/context";
import { useResource } from "../../hooks/use-resource";
import { percent } from "../../lib/utils";
export function GrammarLibrary() {
  const { api, session } = useAuth();
  const summary = useResource(`topics:${session!.actorId}`, () =>
    api.summary(session!.actorId),
  );
  return (
    <>
      <PageHeading
        title="Ngữ pháp, từng chút một"
        description="Hiểu cách dùng. Nhớ bằng ví dụ. Tự tin qua luyện tập."
      />
      {summary.error && (
        <p className="muted mb-5">
          Chưa tải được tiến độ. Bạn vẫn có thể đọc bài học.
        </p>
      )}
      <TopicCards summary={summary.data} />
      <div className="mt-7">
        <Tip>
          Bạn không cần học tất cả trong một ngày. Hãy chọn một chủ đề và dành
          vài phút để hiểu thật rõ.
        </Tip>
      </div>
    </>
  );
}
export function GrammarTopic() {
  const { tense } = useParams();
  const t = topics.find((t) => t.id === tense);
  const { api, session } = useAuth();
  const summary = useResource(`topic:${session!.actorId}`, () =>
    api.summary(session!.actorId),
  );
  if (!t)
    return (
      <>
        <PageHeading title="Chưa tìm thấy bài học" />
        <Button asChild>
          <Link to="/student/grammar">Về thư viện</Link>
        </Button>
      </>
    );
  const skills = summary.data?.skills.filter((s) => s.tense === t.id) ?? [];
  const mastery = skills.length
    ? skills.reduce((n, s) => n + s.mastery, 0) / skills.length
    : 0;
  return (
    <>
      <Link to="/student/grammar" className="text-link mb-6">
        <ArrowLeft size={14} />
        Tất cả bài học
      </Link>
      <PageHeading
        title={t.name}
        description={t.vi}
        action={<Badge variant="secondary">Nền tảng THCS</Badge>}
      />
      <div className="two-col">
        <div className="stack">
          <Card className="panel">
            <div className={`topic-icon tone-${t.color}`}>
              <BookOpen />
            </div>
            <h2>Dùng thì này khi nào?</h2>
            <p className="muted">{t.description}</p>
            <ul className="list-clean">
              {t.uses.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
            <div className="small muted">Dấu hiệu thường gặp</div>
            <div className="flex flex-wrap gap-2">
              {t.signal.split(" · ").map((s) => (
                <Badge key={s} variant="outline">
                  {s}
                </Badge>
              ))}
            </div>
          </Card>
          <Card className="panel">
            <h2>Công thức dễ nhớ</h2>
            <div className="formula">{t.structure}</div>
            <h3>Cùng xem một ví dụ</h3>
            <div className="example">
              <strong>{t.example}</strong>
              <p className="small muted mt-2">{t.translation}</p>
            </div>
            <p className="small muted">
              Phủ định và câu hỏi cần trợ động từ phù hợp: do/does, am/is/are
              hoặc did. Sau do/does/did, dùng động từ nguyên mẫu.
            </p>
          </Card>
        </div>
        <div className="stack">
          <Card className="panel">
            <h3>Hành trình của bạn</h3>
            <div className="progress-caption">
              <span>Mức thành thạo đã ghi nhận</span>
              <strong>
                {skills.length ? percent(mastery) : "Chưa có dữ liệu"}
              </strong>
            </div>
            <Progress value={mastery * 100} />
            <p className="small muted">
              Luyện tập giúp TenseLab hiểu kỹ năng bạn cần củng cố.
            </p>
            <Button asChild>
              <Link to={`/student/practice?tense=${t.id}`}>
                <CheckCircle2 size={17} />
                Bắt đầu luyện tập
                <ArrowRight size={16} />
              </Link>
            </Button>
          </Card>
          <Card className="panel">
            <Lightbulb className="text-primary" />
            <h3>Một lỗi nhỏ, nhớ thật lâu</h3>
            <div className="detail-box font-medium">{t.mistake}</div>
            <p className="muted">{t.tip}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
