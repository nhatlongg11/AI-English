import { Award, BookOpen, Target, Zap } from "lucide-react";
import { useAuth } from "../auth/context";
import { useResource } from "../../hooks/use-resource";
import {
  Loading,
  PageHeading,
  ResourceError,
  Stat,
} from "../../components/common";
import {
  ChartPanel,
  AccuracyChart,
  ErrorChart,
  TenseChart,
} from "../../components/charts/LearningCharts";
import { Card } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { errors, topic } from "../../lib/grammar";
import { percent } from "../../lib/utils";
import {AnswerHelp} from '../ai/AnswerHelp';
export function StudentProgress() {
  const { api, session } = useAuth();
  const result = useResource(`progress:${session!.actorId}`, () =>
    api.summary(session!.actorId),
  );
  if (result.loading) return <Loading />;
  if (result.error || !result.data)
    return (
      <ResourceError
        message={result.error ?? "Không tải được dữ liệu."}
        retry={result.reload}
      />
    );
  const s = result.data;
  return (
    <>
      <PageHeading
        title="Nhìn lại những bước tiến"
        description="Mỗi câu trả lời là một dấu mốc trên hành trình của bạn."
      />
      <div className="stats-grid mb-6" data-guide="progress-stats">
        <Stat icon={<BookOpen />} value={s.total} label="Câu đã hoàn thành" />
        <Stat
          icon={<Target />}
          value={s.confirmed ? percent(s.correct / s.confirmed) : "—"}
          label="Độ chính xác"
          tone="mint"
        />
        <Stat
          icon={<Zap />}
          value={s.xp}
          label="XP đã tích lũy"
          tone="yellow"
        />
        <Stat
          icon={<Award />}
          value={Math.floor(s.xp / 100) + 1}
          label="Cấp độ luyện tập"
          tone="peach"
        />
      </div>
      <p className="small muted mb-5">
        10 XP cho mỗi câu đúng đã được xác nhận. Biểu đồ sử dụng tối đa 100 lượt
        gần nhất; câu chờ kiểm tra không được tính sai.
      </p>
      <div className="dashboard-bottom">
        <ChartPanel title="Độ chính xác qua từng ngày">
          <AccuracyChart attempts={s.attempts} />
        </ChartPanel>
        <ChartPanel title="Bạn tự tin với thì nào?">
          <TenseChart summary={s} />
        </ChartPanel>
        <ChartPanel
          title="Những điều cần luyện thêm"
          subtitle="Chỉ hiển thị lỗi đã phân loại"
        >
          <ErrorChart rows={s.attempts} />
        </ChartPanel>
        <Card className="panel">
          <h3>Kỹ năng của bạn</h3>
          {s.skills.length ? (
            s.skills.map((skill) => (
              <div key={skill.skillId}>
                <div className="progress-caption">
                  <span>
                    {topic(skill.tense).name} · {errors[skill.errorCode]}
                  </span>
                  <strong>{percent(skill.mastery)}</strong>
                </div>
                <Progress value={skill.mastery * 100} className="h-2" />
              </div>
            ))
          ) : (
            <p className="muted">
              Kỹ năng sẽ xuất hiện sau câu trả lời đầu tiên được chấm.
            </p>
          )}
        </Card>
      </div>
      {s.attempts.length>0&&<Card className="panel mt-6"><h2>Xem lại và hỏi AI</h2><p className="small muted my-3">Tối đa 5 câu đã nộp gần nhất. AI chỉ giải thích thêm, không đổi điểm.</p><div className="stack">{s.attempts.slice(0,5).map(attempt=><details className="detail-box" key={attempt.id}><summary className="cursor-pointer"><span lang="en">{attempt.question.content}</span> · {attempt.correct===null?'Chờ kiểm tra':attempt.correct?'Đúng':'Cần ôn thêm'}</summary><AnswerHelp attemptId={attempt.id}/></details>)}</div></Card>}
    </>
  );
}
