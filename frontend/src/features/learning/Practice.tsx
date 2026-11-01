import { useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/context";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Choice,
  EmptyState,
  Loading,
  Notice,
  PageHeading,
  Tip,
} from "../../components/common";
import { SentenceBuilder } from "../../components/games/SentenceBuilder";
import { XpReward, CompletionEmblem } from "../../components/rewards/Reward";
import CountUp from "../../components/rewards/CountUp";
import { errors, games, topic, topics } from "../../lib/grammar";
import { normalizeAnswer } from '../../lib/utils';
import { learningPathLabel } from '../../lib/learning-copy';
import {AnswerHelp} from '../ai/AnswerHelp';
import type {
  Assignment,
  Feedback,
  Game,
  QuestionType,
  SessionResult,
  Tense,
} from "../../types";
const icons = { challenge: Target, builder: Layers3, detective: Search };
export function Practice() {
  const { api, session } = useAuth();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const game = (
    games.some((g) => g.id === search.get("game"))
      ? search.get("game")
      : "challenge"
  ) as Game;
  const tense = topics.some((t) => t.id === search.get("tense"))
    ? (search.get("tense") as Tense)
    : undefined;
  const adaptive = search.get("adaptive") === "1";
  const assignedName = learningPathLabel(session?.mode ?? 'adaptive');
  const [active, setActive] = useState(false);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Feedback[]>([]);
  const [startingXp, setStartingXp] = useState<number | null>(null);
  const submitLock = useRef(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const info = games.find((g) => g.id === game)!;
  const q = assignment?.question;
  const total = 5;
  async function load() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const questionType: QuestionType | undefined = adaptive
        ? undefined
        : game === "challenge"
          ? "multiple_choice"
          : "error_correction";
      const next = await api.next(session!.actorId, { tense, questionType });
      setAssignment(next);
      setAnswer("");
      setIds([]);
      setFeedback(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa tải được câu hỏi.");
    } finally {
      setLoading(false);
    }
  }
  async function start() {
    setActive(true);
    setResults([]);
    setStartingXp(null);
    await Promise.allSettled([
      load(),
      api
        .summary(session!.actorId)
        .then((summary) => setStartingXp(summary.xp)),
    ]);
  }
  useEffect(() => {
    feedbackRef.current?.focus();
  }, [feedback]);
  async function submit() {
    if (!assignment?.question || submitLock.current || feedback) return;
    submitLock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api.submit(
        assignment.decisionId,
        game === "builder" && !adaptive ? { tokenIds: ids } : { answer },
      );
      setFeedback(result);
      setResults((r) => [...r, result]);
      if (result.correct) toast.success("Thêm một bước tiến! +10 XP");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nộp bài chưa thành công.");
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  }
  function finish() {
    const result: SessionResult = {
      answers: results.length,
      correct: results.filter((r) => r.correct).length,
      pending: results.filter((r) => r.correct === null).length,
      xp: results.filter((r) => r.correct).length * 10,
      game,
      ...(startingXp !== null
        ? {
            levelBefore: Math.floor(startingXp / 100) + 1,
            levelAfter:
              Math.floor(
                (startingXp + results.filter((r) => r.correct).length * 10) /
                  100,
              ) + 1,
          }
        : {}),
    };
    sessionStorage.setItem(
      "tenselab-last-result",
      JSON.stringify({ ...result, actor: session!.actorId }),
    );
    navigate("/student/practice/result", { state: result });
  }
  if (!active)
    return (
      <>
        <PageHeading
          title={
            adaptive ? "Luyện tập dành riêng cho bạn" : "Chọn một thử thách nhỏ"
          }
          description={
            adaptive
              ? "Bài tập được chọn từ tiến độ học tập và kỹ năng bạn cần củng cố."
              : "5 câu hỏi, vài phút tập trung, thêm một chút tự tin."
          }
        />
        {!adaptive && (
          <div className="practice-pickers">
            {games.map((g) => {
              const Icon = icons[g.id];
              return (
                <Card
                  key={g.id}
                  className={`game-option ${g.id === game ? "active" : ""}`}
                >
                  <div className={`topic-icon tone-${g.color}`}>
                    <Icon size={24} />
                  </div>
                  <h2>{g.name}</h2>
                  <p>{g.description}</p>
                  <Button
                    variant={g.id === game ? "default" : "outline"}
                    onClick={() =>
                      setSearch((prev) => {
                        prev.set("game", g.id);
                        return prev;
                      })
                    }
                    aria-pressed={g.id === game}
                  >
                    {g.id === game ? "Đã chọn" : "Chọn thử thách"}
                    <ArrowRight size={15} />
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
        <Card className="panel mt-6 max-w-2xl" data-guide="practice-setup">
          <div className="flex gap-4 items-center">
            <div className="topic-icon tone-lavender mb-0">
              <Sparkles />
            </div>
            <div>
              <h2>{adaptive ? assignedName : info.vi}</h2>
              <p className="small muted">
                Không tính giờ. Cứ bình tĩnh suy nghĩ nhé.
              </p>
            </div>
          </div>
          <div className="field">
            <Label htmlFor="practice-topic">Chủ đề luyện tập</Label>
            <Choice
              id="practice-topic"
              value={tense ?? "all"}
              onChange={(v) =>
                setSearch((prev) => {
                  if (v === "all") prev.delete("tense");
                  else prev.set("tense", v);
                  return prev;
                })
              }
              options={[
                { value: "all", label: "Tất cả chủ đề" },
                ...topics.map((t) => ({
                  value: t.id,
                  label: `${t.name} · ${t.vi}`,
                })),
              ]}
            />
          </div>
          <Tip>
            {session?.mode === "baseline"
              ? "Bài học của bạn được sắp theo thứ tự. Bạn vẫn có thể chọn một chủ đề để ôn thêm."
              : "TenseLab sẽ chọn câu đã được kiểm duyệt, phù hợp với kỹ năng của bạn."}
          </Tip>
          <Button onClick={start}>
            Bắt đầu 5 câu hỏi
            <ArrowRight size={16} />
          </Button>
        </Card>
      </>
    );
  const renderType = adaptive
    ? q?.questionType
    : game === "challenge"
      ? "multiple_choice"
      : "error_correction";
  const isBuilder = game === "builder" && !adaptive;
  const canSubmit = isBuilder
    ? Boolean(q?.wordTokens?.length && ids.length === q.wordTokens.length)
    : Boolean(answer.trim());
  return (
    <div className="practice-container">
      <div className="practice-top">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (results.length ? finish() : setActive(false))}
          aria-label="Kết thúc lượt luyện tập"
        >
          <X size={20} />
        </Button>
        <div className="practice-progress">
          <div className="progress-caption">
            <span>{adaptive ? assignedName : info.name}</span>
            <span>
              {Math.min(results.length + (feedback ? 0 : 1), total)}/{total} câu
            </span>
          </div>
          <Progress value={(results.length / total) * 100} className="h-2" />
        </div>
        <div className="reward-pill">
          <Trophy size={14} />
          {results.filter((r) => r.correct).length * 10} XP
        </div>
      </div>
      {loading && !q ? (
        <Loading />
      ) : error && !q ? (
        <>
          <Notice tone="error">{error}</Notice>
          <Button className="mt-4" onClick={load}>
            Tải lại câu hỏi
          </Button>
        </>
      ) : !q ? (
        <EmptyState
          title="Bài tập mới đang được chuẩn bị"
          description="Chưa có câu đã duyệt cho lựa chọn này. Giáo viên sẽ bổ sung nội dung; bạn có thể chọn chủ đề hoặc thử thách khác."
          action={
            <Button onClick={() => setActive(false)} variant="outline">
              <ArrowLeft />
              Đổi thử thách
            </Button>
          }
        />
      ) : (
        <Card key={assignment!.decisionId} className="question-card" data-guide="practice-answer">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <Badge variant="secondary">{topic(q.tense).name}</Badge>
              <Badge variant="outline">Mức {q.difficulty}/5</Badge>
            </div>
            <span className="small muted flex items-center gap-1">
              <ShieldCheck size={13} />
              {q.provenance === "mock" || q.provenance === "synthetic_demo"
                ? "Nội dung mẫu"
                : "Đã được duyệt"}
            </span>
          </div>
          <div>
            {assignment?.reason.skillId && (
              <p className="small muted text-center mb-2">
                Đang luyện:{" "}
                {errors[assignment.reason.skillId.split(":")[1]] ??
                  topic(q.tense).vi}
              </p>
            )}
            <p className="small muted text-center">
              {isBuilder
                ? "Sắp xếp các từ để tạo một câu đúng."
                : renderType === "multiple_choice"
                  ? "Chọn đáp án phù hợp nhất."
                  : renderType === "fill_in_blank"
                    ? "Điền phần còn thiếu vào chỗ trống."
                    : "Tìm lỗi và viết lại câu cho đúng nhé."}
            </p>
            <div className="sentence" lang="en">
              {isBuilder
                ? "Let’s build a sentence."
                : q.content.replace(/^Correct this sentence:\s*/i, "")}
            </div>
          </div>
          {isBuilder ? (
            q.wordTokens ? (
              <SentenceBuilder
                key={assignment!.decisionId}
                tokens={q.wordTokens}
                onChange={setIds}
                disabled={busy || Boolean(feedback)}
              />
            ) : (
              <Notice tone="warning">
                Câu này chưa có dữ liệu từ để ghép. Hãy chọn thử thách Thám tử
                ngữ pháp.
              </Notice>
            )
          ) : renderType === "multiple_choice" ? (
            <div className="options-grid" role="group" aria-label="Các đáp án">
              {q.options.map((option, index) => (
                <button
                  key={`${q.id}:${index}`}
                  className={`answer-card ${answer === option ? "selected" : ""} ${feedback && normalizeAnswer(option) === normalizeAnswer(feedback.correctAnswer) ? "correct" : ""} ${feedback && answer === option && feedback.correct === false ? "wrong" : ""}`}
                  disabled={busy || Boolean(feedback)}
                  aria-pressed={answer === option}
                  onClick={() => setAnswer(option)}
                >
                  <span className="answer-letter">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span lang="en">{option}</span>
                  {feedback && normalizeAnswer(option) === normalizeAnswer(feedback.correctAnswer) && (
                    <CheckCircle2 className="ml-auto" size={19} />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="field">
              <Label htmlFor="student-answer">
                {renderType === "fill_in_blank"
                  ? "Từ hoặc cụm từ còn thiếu"
                  : "Câu đã sửa của bạn"}
              </Label>
              {renderType === "fill_in_blank" ? (
                <Input
                  id="student-answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  maxLength={300}
                  disabled={busy || Boolean(feedback)}
                  autoComplete="off"
                  lang="en"
                />
              ) : (
                <Textarea
                  id="student-answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Write your corrected sentence here…"
                  maxLength={300}
                  disabled={busy || Boolean(feedback)}
                  className="min-h-28 text-base"
                  lang="en"
                />
              )}
              <p className="small muted">
                Chỉ nhập câu trả lời bài tập, không nhập thông tin cá nhân.
              </p>
            </div>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          {feedback && (
            <div
              ref={feedbackRef}
              data-guide="practice-feedback"
              tabIndex={-1}
              className={`feedback ${feedback.correct === false ? "incorrect" : feedback.correct === null ? "uncertain" : ""}`}
              role="status"
            >
              <div className="flex items-center justify-between gap-3">
                <h3>
                  {feedback.correct ? <CheckCircle2 /> : <HelpCircle />}
                  {feedback.correct
                    ? "Chính xác, bạn làm tốt lắm!"
                    : feedback.correct === null
                      ? "Cách diễn đạt này cần kiểm tra thêm"
                      : "Một lỗi nhỏ, thêm một điều hiểu rõ"}
                </h3>
                {feedback.correct && <XpReward />}
              </div>
              <p className="small muted">Câu trả lời tham khảo</p>
              <p className="correct-sentence" lang="en">
                {feedback.correctAnswer}
              </p>
              <p>{feedback.explanationVi}</p>
              {feedback.correct === null && (
                <p className="small">
                  TenseLab chưa thể kết luận đúng hoặc sai. Phản hồi AI chỉ để
                  tham khảo; kết quả này không làm giảm điểm thành thạo.
                </p>
              )}
              {feedback.diagnosis.errorCodes.map((code) => (
                <Badge key={code} variant="outline" className="mr-2">
                  {code} · {errors[code] ?? "Lỗi ngữ pháp"}
                </Badge>
              ))}
              <AnswerHelp key={feedback.attemptId} attemptId={feedback.attemptId}/>
              <p className="small muted">
                Gợi ý: xem lại công thức {topic(q.tense).structure}, rồi thử một
                câu tiếp theo.
              </p>
            </div>
          )}
          <div className="practice-footer">
            <span className="small muted">
              Hiểu rõ quan trọng hơn trả lời nhanh.
            </span>
            {feedback ? (
              <Button
                disabled={loading}
                onClick={() => (results.length >= total ? finish() : load())}
              >
                {loading
                  ? "Đang tải câu tiếp…"
                  : results.length >= total
                    ? "Xem kết quả"
                    : "Câu tiếp theo"}
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Button disabled={busy || loading || !canSubmit} onClick={submit}>
                {busy ? "Đang kiểm tra…" : "Kiểm tra đáp án"}
                <ArrowRight size={16} />
              </Button>
            )}
          </div>
        </Card>
      )}
      {results.length > 0 && !feedback && (
        <Button className="mt-5" variant="ghost" onClick={finish}>
          Kết thúc & xem kết quả
        </Button>
      )}
    </div>
  );
}
export function PracticeResult() {
  const location = useLocation();
  const { session } = useAuth();
  let stored: SessionResult | undefined;
  try {
    const value = JSON.parse(
      sessionStorage.getItem("tenselab-last-result") ?? "null",
    );
    if (value?.actor === session!.actorId) stored = value;
  } catch {
    /* Invalid browser state is ignored. */
  }
  const result = (location.state as SessionResult | null) ?? stored;
  if (!result)
    return (
      <EmptyState
        title="Một hành trình mới đang chờ bạn"
        description="Hoàn thành một lượt luyện tập để xem tổng kết tại đây."
        action={
          <Button asChild>
            <Link to="/student/practice">Bắt đầu luyện tập</Link>
          </Button>
        }
      />
    );
  return (
    <Card className="result-card">
      <CompletionEmblem achievement={result.correct >= 3} />
      <div>
        <span className="eyebrow">MỖI NỖ LỰC ĐỀU ĐÁNG GHI NHẬN</span>
        <h1 className="mt-3">Bạn đã tiến thêm một bước!</h1>
        <p className="muted mt-3">
          {result.correct >= 3
            ? "Một lượt luyện tập thật vững vàng. Giữ nhịp học tốt này nhé!"
            : "Cảm ơn bạn đã kiên trì. Những điều vừa học sẽ giúp bạn ở lần tiếp theo."}
        </p>
      </div>
      <div className="result-grid">
        <div>
          <div className="result-number">
            {result.correct}/{result.answers}
          </div>
          <p className="small muted">Câu đúng xác nhận</p>
        </div>
        <div>
          <div className="result-number">
            +<CountUp to={result.xp} duration={0.9} trigger="load" />
          </div>
          <p className="small muted">XP nhận được</p>
        </div>
        <div>
          <div className="result-number">{result.pending}</div>
          <p className="small muted">Chờ kiểm tra</p>
        </div>
      </div>
      {result.levelAfter &&
        result.levelBefore &&
        result.levelAfter > result.levelBefore && (
          <div className="detail-box">
            <h3>Chào mừng cấp độ mới!</h3>
            <p className="result-number">
              Cấp{" "}
              <CountUp
                from={result.levelBefore}
                to={result.levelAfter}
                duration={0.8}
                trigger="load"
              />
            </p>
            <p className="small muted">
              Một cột mốc từ những câu đúng bạn đã tích lũy.
            </p>
          </div>
        )}
      {result.correct >= 3 && (
        <Badge variant="secondary" className="self-center py-2 px-4">
          <Trophy size={16} className="mr-2" />
          Cột mốc phiên học · 3 câu đúng
        </Badge>
      )}
      <div className="flex justify-center flex-wrap gap-3">
        <Button asChild>
          <Link to="/student/practice">
            Luyện tập tiếp
            <ArrowRight size={16} />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/student/dashboard">Về góc học tập</Link>
        </Button>
      </div>
      <p className="small muted">
        {session?.demo
          ? "Kết quả bản mẫu chỉ minh họa giao diện và không được lưu vào nghiên cứu."
          : "Kết quả đã được lưu trong hành trình học tập của bạn."}
      </p>
    </Card>
  );
}
