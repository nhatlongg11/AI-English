import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  FlaskConical,
  Target,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/context";
import { useResource } from "../../hooks/use-resource";
import {
  Choice,
  EmptyState,
  Loading,
  Notice,
  PageHeading,
  ResourceError,
  Stat,
} from "../../components/common";
import {
  ChartPanel,
  AccuracyChart,
  ComparisonChart,
  ErrorChart,
} from "../../components/charts/LearningCharts";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { percent } from "../../lib/utils";
import { topics } from "../../lib/grammar";
import type { ResearchRow } from "../../types";
import { learningPaths } from "../../lib/learning-copy";
export function csvData(rows: ResearchRow[]): string {
  const columns: (keyof ResearchRow)[] = [
    "attemptId",
    "anonymousStudentId",
    "tense",
    "skillId",
    "correct",
    "errorCode",
    "createdAt",
    "mode",
    "experimentGroup",
    "provenance",
  ];
  const cell = (value: unknown) => {
    let s = String(value ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return `"${s.replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      columns.join(","),
      ...rows.map((r) => columns.map((c) => cell(r[c])).join(",")),
    ].join("\r\n")
  );
}
function download(rows: ResearchRow[], format: "csv" | "json", demo: boolean) {
  const blob = new Blob(
    [
      format === "csv"
        ? csvData(rows)
        : JSON.stringify(
            {
              provenance: demo ? "SYNTHETIC_DEMO" : "collected_learning_logs",
              rows,
            },
            null,
            2,
          ),
    ],
    { type: format === "csv" ? "text/csv;charset=utf-8" : "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `tenselab-${demo ? "DEMO-" : ""}learning-logs.${format}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function assignedOnly(row: ResearchRow) {
  try {
    return (
      !['student_selected_practice','teacher_assigned_exercise'].includes(JSON.parse(row.reason).practiceContext)
    );
  } catch {
    return true;
  }
}
export function ResearchDashboard({
  analytics = false,
}: {
  analytics?: boolean;
}) {
  const { session } = useAuth();
  if (session?.role !== "admin" && !(analytics&&session?.role==='teacher'))
    return (
      <>
        <PageHeading
          title="Phân tích học tập"
          description="Bức tranh học tập bắt đầu từ dữ liệu đáng tin cậy."
        />
        <EmptyState
          title="Chưa có quyền xem dữ liệu học sinh"
          description="Quản trị viên phụ trách xem và tải báo cáo học sinh. Thầy cô có thể nhờ quản trị viên cung cấp phần kết quả cần theo dõi."
        />
        <div className="dashboard-bottom">
          <ChartPanel title="Độ chính xác theo thời gian">
            <div className="chart-empty">Chưa có dữ liệu được cấp quyền.</div>
          </ChartPanel>
          <ChartPanel title="Lỗi ngữ pháp thường gặp">
            <div className="chart-empty">Chưa có dữ liệu được cấp quyền.</div>
          </ChartPanel>
        </div>
      </>
    );
  return <ResearchData analytics={analytics} />;
}
function ResearchData({ analytics }: { analytics: boolean }) {
  const { api, session } = useAuth();
  const resource = useResource(`reports:${analytics}:${session?.actorId}`, () => analytics?api.learningReport():api.research());
  const [mode, setMode] = useState("all");
  const [tense, setTense] = useState("all");
  const [group, setGroup] = useState("all");
  const [includeSelected, setIncludeSelected] = useState(analytics);
  const groups = useMemo(
    () => [...new Set(resource.data?.rows.map((r) => r.experimentGroup) ?? [])],
    [resource.data],
  );
  const rows = (resource.data?.rows ?? []).filter(
    (r) =>
      (mode === "all" || r.mode === mode) &&
      (tense === "all" || r.tense === tense) &&
      (group === "all" || r.experimentGroup === group) &&
      (includeSelected || assignedOnly(r)),
  );
  const confirmed = rows.filter((r) => r.correct !== null);
  const accuracy = confirmed.length
    ? confirmed.filter((r) => r.correct).length / confirmed.length
    : 0;
  if (resource.loading) return <Loading />;
  if (resource.error)
    return <ResourceError message={resource.error} retry={resource.reload} />;
  const synthetic = session?.demo;
  return (
    <>
      <PageHeading
        title={
          analytics ? "Nhìn dữ liệu, hiểu việc học" : "Nghiên cứu & đánh giá"
        }
        description={
          analytics
            ? "Xem các em đã luyện gì, làm tốt ở đâu và cần ôn thêm điều gì."
            : "Theo dõi minh bạch. Phân biệt dữ liệu đã thu thập và điều chưa thể kết luận."
        }
        action={
          <Badge variant={synthetic ? "secondary" : "outline"}>
            <FlaskConical size={13} className="mr-1" />
            {synthetic ? "Dữ liệu mẫu tổng hợp" : "Nhật ký đã thu thập"}
          </Badge>
        }
      />
      {analytics&&session?.role==='teacher'&&<Notice>Báo cáo chỉ gồm học sinh bạn phụ trách. Học sinh chưa làm bài vẫn có trong mục Học sinh.</Notice>}
      <div className="research-label mb-6">
        <strong>
          {synthetic
            ? "BẢN MẪU · Không phải kết quả thực nghiệm."
            : "KẾT QUẢ LUYỆN TẬP · Chưa phải bài kiểm tra đầu vào và sau học."}
        </strong>{" "}
        Biểu đồ giúp nhìn lại bài đã làm. Mỗi nhóm có thể học nội dung và có trình độ
        khác nhau, nên chưa thể dùng riêng biểu đồ này để kết luận cách học nào tốt hơn.
        {rows.some((r) => r.provenance === "mock") &&
          " Một số lượt dùng câu hỏi mẫu; hãy kiểm tra nguồn học liệu trước khi đưa vào đánh giá."}
      </div>
      <div className="filter-row" data-guide="report-filters">
        <Choice
          label="Cách giao bài"
          value={mode}
          onChange={setMode}
          options={[
            { value: "all", label: "Tất cả cách giao bài" },
            ...learningPaths.map(({value,label}) => ({value,label})),
          ]}
        />
        <Choice
          label="Chủ đề"
          value={tense}
          onChange={setTense}
          options={[
            { value: "all", label: "Tất cả các thì" },
            ...topics.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
        <Choice
          label="Nhãn nhóm đánh giá"
          value={group}
          onChange={setGroup}
          options={[
            { value: "all", label: "Tất cả nhóm" },
            ...groups.map((g) => ({ value: g, label: `Nhóm ${g}` })),
          ]}
        />
        <Button
          variant="outline"
          className="ml-auto"
          disabled={!rows.length}
          onClick={() => download(rows, "csv", Boolean(synthetic))}
        >
          <ArrowDownToLine size={16} />
          Xuất CSV
        </Button>
        <Button
          variant="outline"
          disabled={!rows.length}
          onClick={() => download(rows, "json", Boolean(synthetic))}
        >
          JSON
        </Button>
      </div>
      <div className="flex gap-2 items-center mb-5">
        <Checkbox
          id="include-selected"
          checked={includeSelected}
          onCheckedChange={(v) => setIncludeSelected(v === true)}
        />
        <Label htmlFor="include-selected" className="small muted">
          Bao gồm cả bài luyện tập tự chọn và bài thầy cô giao (khác lộ trình phân nhóm)
        </Label>
      </div>
      {resource.data?.truncated && (
        <Notice tone="warning">
          Hiển thị tối đa 10.000 lượt. Bản xuất trên trang chỉ chứa phần dữ liệu
          đã tải. Nếu cần toàn bộ dữ liệu, hãy nhờ người phụ trách hệ thống hỗ trợ.
        </Notice>
      )}
      <div className="stats-grid mb-6" data-guide="report-stats">
        <Stat
          icon={<Users />}
          value={new Set(rows.map((r) => r.anonymousStudentId)).size}
          label="Học sinh có nhật ký"
        />
        <Stat
          icon={<Activity />}
          value={rows.length}
          label="Lượt luyện đã ghi nhận"
          tone="mint"
        />
        <Stat
          icon={<Target />}
          value={confirmed.length ? percent(accuracy) : "—"}
          label="Chính xác · lượt đã chấm"
          tone="yellow"
        />
        <Stat
          icon={<FlaskConical />}
          value={rows.filter((r) => r.correct === null).length}
          label="Lượt chờ kiểm tra"
          tone="peach"
        />
      </div>
      {!analytics && (
        <div className="stats-grid mb-6">
          {[
            "Bài kiểm tra đầu vào",
            "Bài kiểm tra sau học",
            "Mức tăng điểm",
            "Mức giảm lỗi qua kiểm tra",
          ].map((label) => (
            <Card className="panel" key={label}>
              <div className="small muted">{label}</div>
              <div className="unavailable-value">—</div>
              <span className="small muted">
                Chưa có kết quả bài kiểm tra riêng
              </span>
            </Card>
          ))}
        </div>
      )}
      {!rows.length ? (
        <EmptyState
          title="Chưa có nhật ký phù hợp"
          description="Sau khi học sinh hoàn thành bài tập, dữ liệu được cấp quyền sẽ xuất hiện tại đây. Thử đổi bộ lọc nếu đã có dữ liệu."
        />
      ) : (
        <>
          <div className="dashboard-bottom">
            <ChartPanel
              title="Kết quả theo cách giao bài"
              subtitle="Độ chính xác theo thì · % câu đúng trong lượt đã chấm"
            >
              <ComparisonChart rows={rows} />
            </ChartPanel>
            <ChartPanel
              title="Những lỗi được ghi nhận"
              subtitle="Số lượt, không phải tỷ lệ giảm lỗi"
            >
              <ErrorChart rows={rows} />
            </ChartPanel>
          </div>
          <div className="dashboard-bottom">
            <ChartPanel title="Độ chính xác qua từng ngày">
              <AccuracyChart attempts={rows} />
            </ChartPanel>
            <Card className="panel">
              <h3>Diễn giải đúng dữ liệu</h3>
              <ul className="list-clean small muted">
                <li>Câu chưa được kết luận không bị tính sai.</li>
                <li>Nhãn nhóm được chọn khi tạo mã đăng nhập.</li>
                <li>
                  Chưa có bài kiểm tra đầu vào, sau học và mức độ ghi nhớ kiến thức.
                </li>
                <li>
                  Trước khi chia sẻ báo cáo, hãy kiểm tra để tránh làm lộ thông tin học sinh.
                </li>
              </ul>
            </Card>
          </div>
          <Card className="panel mt-6">
            <h3>Tóm tắt theo nhóm</h3>
            <div className="table-scroll">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nhóm</TableHead>
                    <TableHead>Lượt</TableHead>
                    <TableHead>Đúng xác nhận</TableHead>
                    <TableHead>Độ chính xác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...new Set(rows.map((r) => r.experimentGroup))].map((g) => {
                    const a = rows.filter((r) => r.experimentGroup === g);
                    const known = a.filter((r) => r.correct !== null);
                    const correct = known.filter((r) => r.correct).length;
                    return (
                      <TableRow key={g}>
                        <TableCell>{g}</TableCell>
                        <TableCell>{a.length}</TableCell>
                        <TableCell>
                          {correct}/{known.length}
                        </TableCell>
                        <TableCell>
                          {known.length ? percent(correct / known.length) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
