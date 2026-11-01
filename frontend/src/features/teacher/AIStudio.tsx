import { useState, type FormEvent } from "react";
import {useSearchParams} from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  LoaderCircle,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useAuth } from "../auth/context";
import { useResource } from "../../hooks/use-resource";
import {
  Choice,
  EmptyState,
  Notice,
  PageHeading,
} from "../../components/common";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { topics, errors, topic } from "../../lib/grammar";
import { typeLabel } from "./QuestionBank";
import { QuestionReview } from "./QuestionReview";
import type {
  BankQuestion,
  GenerateRequest,
  QuestionType,
  Tense,
} from "../../types";
export function AIStudio() {
  const [search]=useSearchParams();
  const { api, session } = useAuth();
  const health = useResource("studio-health", () => api.health());
  const [tense, setTense] = useState<Tense>(()=>topics.find(t=>t.id===search.get('tense'))?.id??'present_simple');
  const [questionType, setQuestionType] =
    useState<QuestionType>("multiple_choice");
  const [difficulty, setDifficulty] = useState(()=>['1','2','3','4','5'].includes(search.get('difficulty')??'')?search.get('difficulty')!:'1');
  const [count, setCount] = useState("3");
  const [target, setTarget] = useState(()=>Object.hasOwn(errors,search.get('target')??'')?search.get('target')!:'any');
  const [theme, setTheme] = useState("");
  const [model, setModel] = useState<"primary" | "advanced">("primary");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [selected, setSelected] = useState<BankQuestion | null>(null);
  async function generate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setQuestions([]);
    if (theme.trim() && !/^[\p{L}\p{N} ,'-]+$/u.test(theme.trim())) {
      setError(
        "Chủ đề từ vựng chỉ chứa chữ, số, dấu phẩy, dấu nháy và dấu gạch nối.",
      );
      setBusy(false);
      return;
    }
    try {
      const request: GenerateRequest = {
        tense,
        questionType,
        difficulty: Number(difficulty),
        count: Number(count),
        modelTier: model,
        ...(target !== "any" ? { targetErrorCode: target } : {}),
        ...(theme.trim() ? { vocabularyTheme: theme.trim() } : {}),
      };
      const data = await api.generate(request);
      setQuestions(data.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa thể tạo câu hỏi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Một ý tưởng. Nhiều bài học hay."
        description="AI gợi ý câu hỏi; quản trị viên kiểm duyệt trước khi xuất bản cho học sinh."
        action={
          <Badge variant="secondary">
            <Sparkles size={13} className="mr-1" />
            {session?.demo
              ? "AI mô phỏng"
              : health.data?.aiMode === "explicit_mock"
                ? "Đang dùng câu hỏi mẫu"
                : "Soạn bài với AI"}
          </Badge>
        }
      />
      <div className="two-col">
        <Card className="panel">
          <div className="flex items-center gap-3">
            <div className="topic-icon tone-lavender mb-0">
              <WandSparkles />
            </div>
            <div>
              <h2>Thiết kế một lượt câu hỏi</h2>
              <p className="small muted">
                Tạo vài câu cùng lúc, rồi chọn những câu phù hợp với buổi học.
              </p>
            </div>
          </div>
          <form onSubmit={generate} className="stack">
            <div className="form-grid" data-guide="question-settings">
              <div className="field">
                <Label htmlFor="studio-tense">Chủ đề ngữ pháp</Label>
                <Choice
                  id="studio-tense"
                  value={tense}
                  onChange={(v) => setTense(v as Tense)}
                  options={topics.map((t) => ({ value: t.id, label: t.name }))}
                />
              </div>
              <div className="field">
                <Label htmlFor="studio-type">Dạng câu hỏi</Label>
                <Choice
                  id="studio-type"
                  value={questionType}
                  onChange={(v) => setQuestionType(v as QuestionType)}
                  options={Object.entries(typeLabel).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </div>
              <div className="field">
                <Label htmlFor="studio-difficulty">Độ khó</Label>
                <Choice
                  id="studio-difficulty"
                  value={difficulty}
                  onChange={setDifficulty}
                  options={[1, 2, 3, 4, 5].map((v) => ({
                    value: String(v),
                    label: `Mức ${v} ${v === 1 ? "· Làm quen" : v === 5 ? "· Thử thách" : ""}`,
                  }))}
                />
              </div>
              <div className="field">
                <Label htmlFor="studio-count">Số câu (1–10)</Label>
                <Input
                  id="studio-count"
                  type="number"
                  min={1}
                  max={10}
                  required
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>
              <div className="field wide">
                <Label htmlFor="studio-target">Kỹ năng cần củng cố</Label>
                <Choice
                  id="studio-target"
                  value={target}
                  onChange={setTarget}
                  options={[
                    { value: "any", label: "Không giới hạn kỹ năng" },
                    ...Object.entries(errors).map(([value, label]) => ({
                      value,
                      label: `${value} · ${label}`,
                    })),
                  ]}
                />
              </div>
              <div className="field wide">
                <Label htmlFor="studio-theme">
                  Chủ đề từ vựng{" "}
                  <span className="muted font-normal">(tùy chọn)</span>
                </Label>
                <Input
                  id="studio-theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Ví dụ: school, family, hobbies"
                  maxLength={80}
                />
              </div>
              {session?.role === "admin" && (
                <div className="field wide">
                  <Label htmlFor="studio-model">Mức hỗ trợ của AI</Label>
                  <Choice
                    id="studio-model"
                    value={model}
                    onChange={(v) => setModel(v as "primary" | "advanced")}
                    options={[
                      {
                        value: "primary",
                        label: "Thông thường · tiết kiệm hơn",
                      },
                      {
                        value: "advanced",
                        label: "Nâng cao · dùng cho yêu cầu khó hơn",
                      },
                    ]}
                  />
                  <p className="small muted">
                    Mức nâng cao có thể tốn phí hơn. Chỉ dùng khi cần; TenseLab
                    sẽ giữ mức bạn đã chọn.
                  </p>
                </div>
              )}
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <Button
              type="submit"
              className="h-11"
              data-guide="generate-questions"
              disabled={busy || Number(count) < 1 || Number(count) > 10}
            >
              {busy ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <Sparkles size={17} />
              )}{" "}
              {busy ? "Đang soạn và kiểm tra câu hỏi…" : "Tạo câu hỏi nháp"}
            </Button>
          </form>
          <p className="small muted flex gap-2 items-start">
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            Câu hỏi được lưu ở bản nháp. Không có câu nào tự xuất bản sau khi AI
            tạo.
          </p>
        </Card>
        <div className="stack">
          <Card className="panel">
            <div className="panel-head">
              <h3>
                {questions.length
                  ? `${questions.length} câu hỏi đã tạo`
                  : "Bản nháp sẽ xuất hiện ở đây"}
              </h3>
              <Badge variant="outline">Cần kiểm duyệt</Badge>
            </div>
            {busy ? (
              <div role="status" className="empty-state">
                <LoaderCircle className="animate-spin" size={28} />
                <h3>Đang chuẩn bị học liệu…</h3>
                <p>
                  AI đang tạo câu và máy chủ kiểm tra schema. Vui lòng giữ trang
                  này.
                </p>
              </div>
            ) : questions.length ? (
              <div className="stack">
                {questions.map((q, i) => (
                  <div key={q.id} className="detail-box">
                    <div className="flex gap-2 items-center mb-2">
                      <Badge variant="outline">Câu {i + 1}</Badge>
                      <span className="small muted">{topic(q.tense).name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {q.provenance}
                      </Badge>
                    </div>
                    <p className="font-medium" lang="en">
                      {q.content}
                    </p>
                    <Button
                      variant="link"
                      className="p-0 mt-2"
                      onClick={() => setSelected(q)}
                    >
                      <Eye size={15} />
                      {session?.role==='admin'?'Xem đáp án & kiểm duyệt':'Xem nội dung câu hỏi'}
                      <ArrowRight size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Bắt đầu từ mục tiêu học tập"
                description="Chọn thì, dạng câu hỏi và mức độ. Mỗi bản nháp đều cần bạn kiểm tra trước khi đến với học sinh."
              />
            )}
          </Card>
          <Notice>
            Đối với câu xếp từ, hãy tạo dạng “Sửa lỗi / xếp câu”. Sau khi duyệt,
            Sentence Builder sử dụng các từ của đáp án do máy chủ cung cấp.
          </Notice>
        </div>
      </div>
      <QuestionReview
        key={selected?.id ?? "none"}
        question={selected}
        onClose={() => setSelected(null)}
        onReviewed={(updated) => {
          setQuestions((current) =>
            current.map((q) => (q.id === updated.id ? updated : q)),
          );
        }}
      />
    </>
  );
}
