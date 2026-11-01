import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, Search, Sparkles, Plus, FileUp, ShieldCheck, XCircle } from "lucide-react";
import { useAuth } from "../auth/context";
import { useResource } from "../../hooks/use-resource";
import {
  Choice,
  EmptyState,
  Loading,
  PageHeading,
  ResourceError,
} from "../../components/common";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { QuestionReview } from "./QuestionReview";
import { BulkQuestionReview } from './BulkQuestionReview';
import { ManualQuestion, ImportQuestions } from './QuestionAuthoring';
import { questionTypeLabels, sourceLabel } from '../../lib/question-files';
import { topics, topic } from "../../lib/grammar";
import type { BankQuestion, BulkReviewFilters, ReviewAction, Tense } from "../../types";
export const statusLabel = {
  draft: "Chờ duyệt",
  approved: "Đã xuất bản",
  rejected: "Đã từ chối",
};
export const typeLabel = questionTypeLabels;
export function QuestionBank() {
  const { api,session } = useAuth();
  const [status, setStatus] = useState("all");
  const [tense, setTense] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<BankQuestion | null>(null);
  const [editor,setEditor]=useState<'manual'|'import'|null>(null);
  const [bulkAction,setBulkAction]=useState<ReviewAction|null>(null);
  const bulkFilters:BulkReviewFilters={...(tense!=='all'?{tense:tense as Tense}:{}),...(search.trim()?{search:search.trim()}: {})};
  const resource = useResource(`bank:${status}:${tense}:${page}`, () =>
    api.questions(
      `${status !== "all" ? `status=${status}&` : ""}${tense !== "all" ? `tense=${tense}&` : ""}offset=${page * 100}`,
    ),
  );
  const questions = (resource.data?.questions ?? []).filter(
    (q) =>
      (status === "all" || q.status === status) &&
      (tense === "all" || q.tense === tense) &&
      `${q.content} ${q.errorCode}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  function saved(created:BankQuestion[]) {
    setEditor(null);setStatus('draft');setTense('all');setSearch('');setPage(0);resource.reload();
    if(created.length===1)setSelected(created[0]);
  }
  return (
    <>
      <PageHeading
        title="Ngân hàng câu hỏi"
        description="Học liệu tốt bắt đầu từ một lần kiểm tra cẩn thận."
        action={
          <div className="bank-actions" data-guide="bank-authoring">
          <Button variant="outline" onClick={()=>setEditor('import')} disabled={api.demo}><FileUp size={16}/>Nhập từ tệp</Button>
          <Button onClick={()=>setEditor('manual')} disabled={api.demo}><Plus size={16}/>Tự soạn câu hỏi</Button>
          <Button asChild variant="secondary">
            <Link to="/teacher/ai-studio">
              <Sparkles size={16} />
              Tạo với AI
            </Link>
          </Button>
          </div>
        }
      />
      {api.demo&&<p className="small muted mb-5">Đăng nhập bằng mã giáo viên để tự soạn và nhập câu hỏi vào kho thật.</p>}
      <div className="filter-row" data-guide="bank-filters">
        <div className="relative flex-1 min-w-52">
          <Search
            size={16}
            className="absolute left-3 top-3 text-muted-foreground"
          />
          <Input
            aria-label="Tìm nội dung câu hỏi trong trang"
            className="pl-9"
            placeholder="Tìm nội dung hoặc mã lỗi…"
            value={search}
            maxLength={200}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Choice
          label="Trạng thái"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(0);
          }}
          options={[
            { value: "all", label: "Tất cả trạng thái" },
            ...Object.entries(statusLabel).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        <Choice
          label="Thì ngữ pháp"
          value={tense}
          onChange={(v) => {
            setTense(v);
            setPage(0);
          }}
          options={[
            { value: "all", label: "Tất cả các thì" },
            ...topics.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
      </div>
      {session?.role==='admin'&&!api.demo&&(status==='all'||status==='draft')&&<div className="flex flex-wrap items-center gap-3 mb-5">
        <Button variant="secondary" onClick={()=>setBulkAction('approve')} disabled={resource.loading||Boolean(resource.error)}><ShieldCheck size={16}/>Duyệt tất cả</Button>
        <Button variant="outline" onClick={()=>setBulkAction('reject')} disabled={resource.loading||Boolean(resource.error)}><XCircle size={16}/>Từ chối tất cả</Button>
        <span className="small muted">Tất cả câu chờ duyệt khớp bộ lọc, ở mọi trang.</span>
      </div>}
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ResourceError message={resource.error} retry={resource.reload} />
      ) : !questions.length ? (
        <EmptyState
          title="Chưa có câu hỏi phù hợp"
          description="Bạn có thể tự soạn, nhập câu hỏi từ tệp hoặc nhờ AI gợi ý. Câu mới luôn được lưu ở bản nháp để kiểm tra trước."
          action={
            <Button asChild>
              <Link to="/teacher/ai-studio">
                Mở AI Studio
                <ArrowRight size={16} />
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="p-0 overflow-hidden shadow-none" data-guide="question-list">
          <div className="table-scroll">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Câu hỏi</TableHead>
                  <TableHead>Chủ đề</TableHead>
                  <TableHead>Độ khó</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right pr-6">Kiểm duyệt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="question-content pl-6 py-4">
                      <div className="font-medium" lang="en">
                        {q.content}
                      </div>
                      <div className="provenance">
                        {typeLabel[q.questionType]} · {q.errorCode} ·{" "}
                        {sourceLabel(q.provenance)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {topic(q.tense).name}
                    </TableCell>
                    <TableCell>
                      <span className="small">{q.difficulty}/5</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          q.status === "approved" ? "secondary" : "outline"
                        }
                      >
                        {statusLabel[q.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(q)}
                      >
                        <Eye size={15} />
                        {q.status === "draft" ? session?.role==='admin'?'Xem & duyệt':'Xem nội dung' : "Chi tiết"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-5 small muted flex justify-between items-center gap-3">
            <span>
              Trang {page + 1} · {questions.length} câu trong trang
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Trang trước"
              >
                <ArrowLeft size={15} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(resource.data?.questions.length ?? 0) < 100}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Trang sau"
              >
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </Card>
      )}
      <QuestionReview
        key={selected?.id ?? "none"}
        question={selected}
        onClose={() => setSelected(null)}
        onReviewed={resource.reload}
      />
      {editor==='manual'&&<ManualQuestion onClose={()=>setEditor(null)} onSaved={saved}/>}
      {editor==='import'&&<ImportQuestions onClose={()=>setEditor(null)} onSaved={saved}/>}
      {bulkAction&&<BulkQuestionReview action={bulkAction} filters={bulkFilters} onClose={()=>setBulkAction(null)} onReviewed={()=>{setPage(0);resource.reload();}}/>}
    </>
  );
}
