import { useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Download, FileUp, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/context";
import { Choice, Notice } from "../../components/common";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { errors, topics } from "../../lib/grammar";
import {
  downloadQuestionTemplate,
  parseQuestionFile,
  questionTypeLabels,
} from "../../lib/question-files";
import type {
  BankQuestion,
  ImportPreview,
  QuestionDraft,
  QuestionType,
  Tense,
} from "../../types";

interface EditorProps {
  onClose: () => void;
  onSaved: (questions: BankQuestion[]) => void;
}
function Modal({
  title,
  description,
  busy,
  onClose,
  children,
}: {
  title: string;
  description: string;
  busy: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="authoring-dialog sm:max-w-3xl"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute right-3 top-3"
          aria-label="Đóng trình soạn câu hỏi"
          onClick={onClose}
          disabled={busy}
        >
          <X size={18} />
        </Button>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function ManualQuestion({ onClose, onSaved }: EditorProps) {
  const { api } = useAuth();
  const [tense, setTense] = useState<Tense>("present_simple");
  const [questionType, setType] = useState<QuestionType>("multiple_choice");
  const [difficulty, setDifficulty] = useState("1");
  const [skill, setSkill] = useState("E01");
  const [content, setContent] = useState("");
  const [answer, setAnswer] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [rule, setRule] = useState("");
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const lock = useRef(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setIssues([]);
    const draft: QuestionDraft = {
      tense,
      questionType,
      difficulty: Number(difficulty),
      errorCode: skill,
      content: content.trim(),
      options:
        questionType === "multiple_choice"
          ? options.map((text) => ({ text: text.trim(), errorCode: null }))
          : [],
      correctAnswer:
        questionType === "multiple_choice"
          ? options[correct].trim()
          : answer.trim(),
      explanationVi: explanation.trim(),
      grammarRule: rule.trim(),
    };
    try {
      const preview = await api.previewImport([draft]);
      if (preview.invalidCount) {
        setIssues(preview.rows[0].errors);
        return;
      }
      if (preview.duplicateCount) {
        setIssues([
          "Câu này đã có trong kho. Hãy tìm lại câu hiện có hoặc đổi nội dung.",
        ]);
        return;
      }
      const result = await api.createQuestion(draft);
      toast.success(
        "Đã lưu bản nháp. Câu hỏi đang chờ quản trị viên duyệt.",
      );
      onSaved([result.question]);
    } catch (error) {
      setIssues([
        error instanceof Error
          ? error.message
          : "Chưa lưu được câu hỏi. Nội dung bạn nhập vẫn được giữ.",
      ]);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Tự soạn câu hỏi"
      description="Dùng bài của thầy cô. Câu hỏi được lưu ở bản nháp để kiểm tra trước khi giao cho học sinh."
      busy={busy}
      onClose={onClose}
    >
      <form className="stack" onSubmit={save}>
        <fieldset disabled={busy} className="authoring-fields">
          <div className="form-grid">
            <div className="field">
              <Label htmlFor="manual-tense">Chủ đề ngữ pháp</Label>
              <Choice
                id="manual-tense"
                value={tense}
                onChange={(v) => setTense(v as Tense)}
                options={topics.map((t) => ({ value: t.id, label: t.vi }))}
              />
            </div>
            <div className="field">
              <Label htmlFor="manual-type">Dạng bài</Label>
              <Choice
                id="manual-type"
                value={questionType}
                onChange={(v) => setType(v as QuestionType)}
                options={Object.entries(questionTypeLabels).map(
                  ([value, label]) => ({ value, label }),
                )}
              />
            </div>
            <div className="field">
              <Label htmlFor="manual-difficulty">Độ khó</Label>
              <Choice
                id="manual-difficulty"
                value={difficulty}
                onChange={setDifficulty}
                options={[1, 2, 3, 4, 5].map((v) => ({
                  value: String(v),
                  label: `Mức ${v}${v === 1 ? " · Làm quen" : v === 5 ? " · Thử thách" : ""}`,
                }))}
              />
            </div>
            <div className="field">
              <Label htmlFor="manual-skill">Điểm ngữ pháp cần luyện</Label>
              <Choice
                id="manual-skill"
                value={skill}
                onChange={setSkill}
                options={Object.entries(errors).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </div>
          </div>
          <div className="field">
            <Label htmlFor="manual-content">Đề bài bằng tiếng Anh</Label>
            <Textarea
              id="manual-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              minLength={8}
              maxLength={600}
              required
              rows={3}
              placeholder={
                questionType === "fill_in_blank"
                  ? "Ví dụ: Every day, she ____ (walk) to school."
                  : questionType === "error_correction"
                    ? "Nhập một câu có lỗi để học sinh sửa lại."
                    : "Ví dụ: Every day, she ____ to school."
              }
            />
            {questionType === "fill_in_blank" && (
              <p className="small muted">
                Dùng đúng một chỗ trống ____ và đặt động từ gợi ý ngay sau đó,
                ví dụ: ____ (walk).
              </p>
            )}
            {questionType === "error_correction" && (
              <p className="small muted">
                Đáp án là cả câu đã sửa đúng. TenseLab cũng dùng câu này cho trò
                xếp từ.
              </p>
            )}
          </div>
          {questionType === "multiple_choice" ? (
            <fieldset className="answer-options">
              <legend>Các lựa chọn — chọn một đáp án đúng</legend>
              {options.map((value, index) => (
                <div
                  className={`manual-option ${correct === index ? "key" : ""}`}
                  key={index}
                >
                  <input
                    type="radio"
                    name="manual-correct"
                    checked={correct === index}
                    onChange={() => setCorrect(index)}
                    aria-label={`Chọn ${String.fromCharCode(65 + index)} làm đáp án đúng`}
                  />
                  <Label htmlFor={`manual-option-${index}`}>
                    {String.fromCharCode(65 + index)}
                  </Label>
                  <Input
                    id={`manual-option-${index}`}
                    aria-label={`Đáp án ${String.fromCharCode(65 + index)}`}
                    value={value}
                    onChange={(e) =>
                      setOptions((current) =>
                        current.map((text, i) =>
                          i === index ? e.target.value : text,
                        ),
                      )
                    }
                    required
                    maxLength={200}
                  />
                  {options.length > 3 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Xóa đáp án ${String.fromCharCode(65 + index)}`}
                      onClick={() => {
                        setOptions((current) =>
                          current.filter((_, i) => i !== index),
                        );
                        setCorrect((current) =>
                          current === index
                            ? 0
                            : current > index
                              ? current - 1
                              : current,
                        );
                      }}
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
              ))}
              {options.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOptions((current) => [...current, ""])}
                >
                  <Plus size={14} />
                  Thêm lựa chọn
                </Button>
              )}
            </fieldset>
          ) : (
            <div className="field">
              <Label htmlFor="manual-answer">Đáp án đúng</Label>
              <Input
                id="manual-answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                required
                maxLength={300}
                placeholder={
                  questionType === "fill_in_blank"
                    ? "Chỉ nhập phần còn thiếu, ví dụ: walks"
                    : "Nhập cả câu đã sửa đúng."
                }
              />
            </div>
          )}
          <div className="field">
            <Label htmlFor="manual-explanation">
              Giải thích bằng tiếng Việt
            </Label>
            <Textarea
              id="manual-explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              required
              minLength={12}
              maxLength={1500}
              rows={3}
              placeholder="Giải thích vì sao đáp án đúng để học sinh hiểu và tự sửa lỗi."
            />
          </div>
          <div className="field">
            <Label htmlFor="manual-rule">Quy tắc cần ghi nhớ</Label>
            <Textarea
              id="manual-rule"
              value={rule}
              onChange={(e) => setRule(e.target.value)}
              required
              minLength={5}
              maxLength={500}
              rows={2}
              placeholder="Ví dụ: Với he, she, it ở hiện tại đơn, động từ thêm s hoặc es."
            />
          </div>
        </fieldset>
        {!!issues.length && (
          <div role="alert" className="authoring-errors">
            <strong>Mình cần sửa một chút trước khi lưu:</strong>
            <ul>
              {issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="authoring-footer">
          <span className="small muted">Không dùng AI.</span>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Hủy
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Đang kiểm tra và lưu…" : "Lưu bản nháp"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

async function readFileText(file: File) {
  if (typeof file.text === "function") return file.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Chưa đọc được tệp. Hãy chọn lại tệp nhé."));
    reader.readAsText(file, "UTF-8");
  });
}
export function ImportQuestions({ onClose, onSaved }: EditorProps) {
  const { api } = useAuth();
  const [fileName, setFileName] = useState("");
  const [questions, setQuestions] = useState<unknown[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [skip, setSkip] = useState(true);
  const request = useRef(0);
  const lock = useRef(false);
  async function choose(file: File | undefined) {
    const current = ++request.current;
    setPreview(null);
    setQuestions([]);
    setError("");
    setFileName(file?.name ?? "");
    if (!file) {
      setReading(false);
      return;
    }
    if (file.size > 256 * 1024) {
      setReading(false);
      setError(
        "Tệp lớn hơn 256 KB. Hãy chia thành các tệp nhỏ, mỗi tệp tối đa 50 câu.",
      );
      return;
    }
    setReading(true);
    try {
      const text = await readFileText(file);
      if (current !== request.current) return;
      const data = parseQuestionFile(file.name, text);
      const checked = await api.previewImport(data);
      if (current !== request.current) return;
      setQuestions(data);
      setPreview(checked);
    } catch (err) {
      if (current === request.current)
        setError(err instanceof Error ? err.message : "Chưa đọc được tệp.");
    } finally {
      if (current === request.current) setReading(false);
    }
  }
  async function save() {
    if (
      lock.current ||
      !preview ||
      preview.invalidCount ||
      (!skip && preview.duplicateCount) ||
      !preview.readyCount
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api.importQuestions(questions, skip);
      toast.success(
        `Đã lưu ${result.questions.length} câu nháp${result.skipped ? `, bỏ qua ${result.skipped} câu trùng` : ""}.`,
      );
      onSaved(result.questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa lưu được câu hỏi.");
      try {
        setPreview(await api.previewImport(questions));
      } catch {
        /* Keep the original error and file selection for retry. */
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Nhập câu hỏi từ tệp"
      description="Dùng tệp mẫu để điền bài có sẵn. Xem trước và sửa lỗi trước khi thêm vào kho."
      busy={busy}
      onClose={() => {
        request.current++;
        onClose();
      }}
    >
      <div className="import-template-box">
        <Download size={22} />
        <div>
          <strong>Chưa có tệp đúng mẫu?</strong>
          <p>
            Tải mẫu có cả 3 dạng bài. Trong Excel, chọn lưu thành CSV UTF-8.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => downloadQuestionTemplate("csv")}
        >
          Mẫu CSV
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => downloadQuestionTemplate("json")}
        >
          Mẫu JSON
        </Button>
      </div>
      <div className="field">
        <Label htmlFor="question-file">Chọn tệp CSV hoặc JSON</Label>
        <Input
          id="question-file"
          type="file"
          accept=".csv,.json,text/csv,application/json"
          disabled={busy}
          onChange={(e) => {
            void choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <p className="small muted">
          Tối đa 50 câu / 256 KB mỗi lần. Câu có lỗi cần được sửa trong tệp rồi
          chọn lại; chưa có câu nào được lưu ở bước xem trước.
        </p>
      </div>
      {reading && (
        <p role="status" className="small muted">
          Đang đọc và kiểm tra {fileName}…
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {preview && (
        <>
          <div className="import-summary" role="status">
            <span>
              <CheckCircle2 size={16} />
              <strong>{preview.readyCount}</strong> câu sẵn sàng
            </span>
            <span>{preview.duplicateCount} câu trùng</span>
            <span>{preview.invalidCount} câu cần sửa</span>
          </div>
          <div className="flex gap-2 items-start">
            <Checkbox
              id="skip-import-duplicates"
              checked={skip}
              onCheckedChange={(value) => setSkip(value === true)}
              disabled={busy}
            />
            <Label htmlFor="skip-import-duplicates">
              Bỏ qua câu đã có trong kho hoặc lặp trong tệp
            </Label>
          </div>
          {!!preview.invalidCount && (
            <Notice tone="warning">
              Chưa thể lưu. Hãy sửa các câu được đánh dấu rồi chọn lại tệp; cả
              tệp sẽ được lưu cùng một lần khi hợp lệ.
            </Notice>
          )}
          {!skip && preview.duplicateCount > 0 && (
            <Notice tone="warning">
              Có câu bị trùng. Hãy bật bỏ qua câu trùng hoặc sửa tệp trước khi lưu.
            </Notice>
          )}
          <div className="import-preview" aria-label="Xem trước câu hỏi">
            {preview.rows.map((row) => (
              <div
                className={`import-preview-row ${!row.valid ? "invalid" : ""}`}
                key={row.row}
              >
                <span className="import-row-number">{row.row}</span>
                <div>
                  <p lang="en">{row.content || "Chưa có đề bài hợp lệ"}</p>
                  <span className="small muted">
                    {!row.valid
                      ? "Cần sửa"
                      : row.duplicate === "bank"
                        ? "Đã có trong kho"
                        : row.duplicate === "file"
                          ? "Lặp trong tệp"
                          : "Sẵn sàng lưu bản nháp"}
                  </span>
                  {!!row.errors.length && (
                    <ul className="small text-destructive">
                      {row.errors.map((message, i) => (
                        <li key={i}>{message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="authoring-footer">
        <span className="small muted">
          <FileUp size={14} className="inline mr-1" />
          Chỉ thêm bản nháp, chưa giao cho học sinh.
        </span>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            request.current++;
            onClose();
          }}
          disabled={busy}
        >
          Hủy
        </Button>
        <Button
          onClick={save}
          disabled={
            busy ||
            reading ||
            !preview ||
            preview.invalidCount > 0 ||
            (!skip && preview.duplicateCount > 0) ||
            preview.readyCount === 0
          }
        >
          {busy ? "Đang lưu…" : `Nhập ${preview?.readyCount ?? 0} câu vào kho`}
        </Button>
      </div>
    </Modal>
  );
}
