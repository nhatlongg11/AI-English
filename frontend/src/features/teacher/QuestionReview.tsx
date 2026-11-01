import { useState } from "react";
import { CheckCircle2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/context";
import type { BankQuestion } from "../../types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Notice } from "../../components/common";
import { errors, topic } from "../../lib/grammar";
import { normalizeAnswer } from '../../lib/utils';
import { sourceLabel } from '../../lib/question-files';
export function QuestionReview({
  question,
  onClose,
  onReviewed,
}: {
  question: BankQuestion | null;
  onClose: () => void;
  onReviewed: (question: BankQuestion) => void;
}) {
  const { api,session } = useAuth();
  const canReview=session?.role==='admin';
  const ownQuestion=question?.createdBy===session?.actorId;
  const [note, setNote] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function review(action: "approve" | "reject") {
    if (!question || busy || !canReview || (action==='approve'&&ownQuestion)) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api.review(question.id, action, note.trim());
      toast.success(
        action === "approve"
          ? "Đã duyệt. Câu hỏi sẵn sàng cho học sinh."
          : "Đã từ chối câu hỏi.",
      );
      onReviewed(updated);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không thể lưu kết quả kiểm duyệt.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={Boolean(question)}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{canReview?'Kiểm tra trước khi xuất bản':'Xem nội dung câu hỏi'}</DialogTitle>
          <DialogDescription>
            Xác nhận tính chính xác của ngữ pháp, đáp án duy nhất và ánh xạ lỗi.
            Quản trị viên duyệt trước khi câu hỏi được giao cho học sinh.
          </DialogDescription>
        </DialogHeader>
        {question && (
          <div className="stack">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">{topic(question.tense).name}</Badge>
              <Badge variant="outline">Độ khó {question.difficulty}/5</Badge>
              <Badge variant="outline">{sourceLabel(question.provenance)}</Badge>
            </div>
            <h2 lang="en">{question.content}</h2>
            <div>
              {question.options.map((option, i) => (
                <div
                  key={i}
                    className={`review-option ${normalizeAnswer(option.text) === normalizeAnswer(question.correctAnswer) ? "key" : ""}`}
                >
                  <div className="flex justify-between gap-2">
                    <span lang="en">{option.text}</span>
                      {normalizeAnswer(option.text) === normalizeAnswer(question.correctAnswer) ? (
                      <CheckCircle2 size={17} />
                    ) : (
                      option.errorCode && (
                        <span className="small muted">{option.errorCode}</span>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="detail-box">
              <div className="small muted">ĐÁP ÁN & QUY TẮC</div>
              <strong lang="en">{question.correctAnswer}</strong>
              <p>{question.explanationVi}</p>
              <p className="small muted">{question.grammarRule}</p>
              <p className="small">
                {question.errorCode} · {errors[question.errorCode]}
              </p>
            </div>
            <div className="small muted">
              {question.model==='human'?'Giáo viên cung cấp':`Model: ${question.model}`} · Tạo lúc{" "}
              {new Date(question.generatedAt).toLocaleString("vi-VN")}
            </div>
            {question.status === "draft" && !canReview ? <Notice>Chờ quản trị viên duyệt. Giáo viên có thể soạn và gửi câu hỏi; quản trị viên sẽ kiểm tra trước khi xuất bản.</Notice> : question.status === "draft" ? (
              <>
                {ownQuestion&&<Notice>Cần một quản trị viên khác duyệt câu hỏi do bạn tạo.</Notice>}
                <div className="field">
                  <Label htmlFor="review-note">
                    Ghi chú kiểm duyệt (ít nhất 5 ký tự)
                  </Label>
                  <Textarea
                    id="review-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    placeholder="Nêu nhận xét về câu hỏi và các đáp án…"
                  />
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="review-checked"
                    checked={checked}
                    onCheckedChange={(v) => setChecked(v === true)}
                  />
                  <Label htmlFor="review-checked" className="text-sm leading-6">
                    Tôi đã kiểm tra ngữ pháp, đáp án duy nhất, độ khó phù hợp và
                    ý nghĩa của từng distractor.
                  </Label>
                </div>
                {error && <Notice tone="error">{error}</Notice>}
                <div className="flex flex-wrap gap-3 justify-end">
                  <Button
                    variant="outline"
                    disabled={busy || note.trim().length < 5}
                    onClick={() => review("reject")}
                  >
                    <X size={16} />
                    Từ chối
                  </Button>
                  <Button
                    disabled={busy || ownQuestion || !checked || note.trim().length < 5}
                    onClick={() => review("approve")}
                  >
                    <ShieldCheck size={16} />
                    {busy ? "Đang lưu…" : "Duyệt & xuất bản"}
                  </Button>
                </div>
              </>
            ) : (
              <Notice>
                Câu hỏi đã được{" "}
                {question.status === "approved" ? "duyệt" : "từ chối"}. Bản ghi
                được giữ nguyên để bảo toàn lịch sử.
              </Notice>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
