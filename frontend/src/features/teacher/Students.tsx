import { useState, type FormEvent } from "react";
import { Copy, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/context";
import { useResource } from "../../hooks/use-resource";
import {
  EmptyState,
  Loading,
  Notice,
  PageHeading,
  ResourceError,
} from "../../components/common";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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
import { learningPaths, learningPathLabel } from "../../lib/learning-copy";
import {studentLabel} from '../../lib/student-identity';
import {StudentProfile} from './StudentProfile';
export function Students() {
  const { api,session } = useAuth();
  const admin=session?.role==='admin';
  const teachers=useResource(`teacher-choices:${session?.actorId}`,()=>admin?api.teachers():Promise.resolve({teachers:[]}));
  const [page,setPage]=useState(0);
  const rows = useResource(`students:${session?.actorId}:${page}`, () => api.students(page*100));
  const [teacherId,setTeacherId]=useState('');
  const [mode, setMode] = useState("adaptive");
  const [group, setGroup] = useState("general");
  const [displayName,setDisplayName]=useState('');
  const [className,setClassName]=useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{
    id: string;
    token: string;
    mode: string;
    experimentGroup: string;
  } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setCreated(null);
    try {
      setCreated(await api.provision(mode,group,admin&&teacherId?teacherId:undefined,displayName.trim(),className.trim()));
      setPage(0);rows.reload();
      toast.success(
        "Mã đăng nhập đã sẵn sàng. Hãy sao chép để gửi riêng cho học sinh.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cấp mã.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Giúp học sinh bắt đầu"
        description="Tạo mã đăng nhập, chọn cách giao bài và theo dõi việc luyện tập."
      />
      <div className="two-col">
        <Card className="panel" data-guide="student-account">
          <h2>Tạo mã đăng nhập</h2>
          <p className="small muted">Mỗi em dùng một mã riêng để giữ lại tiến bộ của mình.</p>
          <form onSubmit={submit} className="stack">
            <div className="field"><Label htmlFor="student-name">Họ và tên</Label><Input id="student-name" required maxLength={80} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Ví dụ: Nguyễn Văn An"/></div>
            <div className="field"><Label htmlFor="student-class">Lớp</Label><Input id="student-class" required maxLength={40} value={className} onChange={e=>setClassName(e.target.value)} placeholder="Ví dụ: 8A1"/><p className="small muted">Hiển thị theo dạng student_họ_và_tên_lớp_ID. Họ tên và lớp không gửi cho AI.</p></div>
            {admin&&<TeacherSelect value={teacherId} onChange={setTeacherId} teachers={teachers.data?.teachers??[]} disabled={teachers.loading||!!teachers.error}/>}
            {admin&&teachers.error&&<ResourceError message={teachers.error} retry={teachers.reload}/>}
            <fieldset className="learning-paths" data-guide="learning-path">
              <legend>Học sinh sẽ nhận bài như thế nào?</legend>
              <p className="small muted mb-3">Nếu chưa biết chọn gì, hãy giữ lựa chọn đầu tiên.</p>
              {learningPaths.map(path => (
                <label className={`learning-path ${mode === path.value ? 'selected' : ''}`} key={path.value}>
                  <input type="radio" name="student-path" value={path.value} checked={mode === path.value} onChange={() => setMode(path.value)} />
                  <span><strong>{path.label}</strong>{path.value === 'adaptive' && <span className="path-recommendation">Gợi ý</span>}<span className="path-description">{path.description}</span></span>
                </label>
              ))}
            </fieldset>
            <details className="optional-settings" data-guide="evaluation-options">
              <summary>Tùy chọn cho đợt đánh giá</summary>
              <p className="small muted">Chỉ cần dùng khi muốn so sánh kết quả của các nhóm học sinh. Có thể bỏ qua khi học bình thường.</p>
              <div className="field mt-3">
              <Label htmlFor="student-group">Nhãn nhóm để xem báo cáo</Label>
              <Input
                id="student-group"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                pattern="[a-zA-Z0-9_-]+"
                maxLength={40}
                required
                placeholder="Ví dụ: NHOM_A"
                aria-describedby="student-group-help"
              />
              <p className="small muted" id="student-group-help">
                Dùng chữ không dấu, số, dấu gạch ngang hoặc gạch dưới. Đây là nhãn
                để lọc báo cáo, không tạo lớp học hay lưu tên học sinh.
              </p>
              </div>
            </details>
            <p className="small muted">Cách giao bài và nhãn nhóm sẽ được giữ nguyên cho mã này.</p>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" disabled={busy||!displayName.trim()||!className.trim()} data-guide="create-student">
              <Plus size={16} />
              {busy ? "Đang tạo mã…" : "Tạo mã cho học sinh"}
            </Button>
          </form>
          {created && (
            <div className="detail-box">
              <h3 className="flex gap-2 items-center" role="status">
                <ShieldCheck size={18} />
                Mã đã sẵn sàng — sao chép trước khi rời trang
              </h3>
              <p className="small muted">{learningPathLabel(created.mode)}</p>
              <code className="block break-all p-3 my-3 bg-card rounded-lg select-all">
                {created.token}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(created.token);
                    toast.success("Đã sao chép mã truy cập.");
                  } catch {
                    toast.error(
                      "Chưa thể sao chép. Hãy chọn mã và sao chép thủ công.",
                    );
                  }
                }}
              >
                <Copy size={14} />
                Sao chép
              </Button>
            </div>
          )}
        </Card>
        <Card className="panel">
          <h3>Ba bước để bắt đầu</h3>
          <ol className="account-steps">
            <li><span>1</span><div><strong>Tạo một mã cho mỗi em</strong><p>Chọn cách giao bài phù hợp rồi bấm tạo mã.</p></div></li>
            <li><span>2</span><div><strong>Gửi mã riêng cho học sinh</strong><p>Các em dán mã vào trang đăng nhập, không cần email hay mật khẩu.</p></div></li>
            <li><span>3</span><div><strong>Cùng nhìn lại tiến bộ</strong><p>Sau khi các em trả lời bài tập, kết quả sẽ xuất hiện ở bảng bên dưới.</p></div></li>
          </ol>
          <p className="small muted">
            Mã vừa tạo sẽ xuất hiện ngay trong danh sách, kể cả khi em chưa làm bài.
            {admin?' Bạn có thể giao học sinh cho giáo viên phụ trách.':' Bạn chỉ thấy học sinh do mình tạo mã hoặc được quản trị viên giao phụ trách.'}
          </p>
          <Notice>
            Giữ mã đăng nhập như chìa khóa của mỗi em: gửi riêng và lưu ở nơi an toàn.
          </Notice>
        </Card>
      </div>
      <Card className="panel mt-6" data-guide="student-activity">
        <h3>{admin?'Danh sách học sinh':'Học sinh của bạn'}</h3>
        {rows.loading ? (
          <Loading />
        ) : rows.error ? (
          <ResourceError message={rows.error} retry={rows.reload} />
        ) : !rows.data?.students.length ? (
          <EmptyState
            title="Chưa có học sinh trong danh sách"
            description="Tạo mã đăng nhập đầu tiên ở trên để giúp học sinh bắt đầu."
          />
        ) : (
          <div className="table-scroll">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Học sinh</TableHead>
                  <TableHead>Nhóm</TableHead>
                  <TableHead>Cách giao bài</TableHead>
                  <TableHead>Lượt luyện</TableHead>
                  <TableHead>Độ chính xác</TableHead>
                  {admin&&<TableHead>Giáo viên phụ trách</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.data.students.map((student) => {
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-mono text-xs">
                        <div className="font-sans break-words" title={student.id}>{studentLabel(student)}</div>
                        <StudentProfile student={student} onSaved={rows.reload}/>
                      </TableCell>
                      <TableCell>{student.experimentGroup === 'general' ? 'Học thường ngày' : student.experimentGroup}</TableCell>
                      <TableCell>{learningPathLabel(student.mode)}</TableCell>
                      <TableCell>{student.total||'Chưa làm bài'}</TableCell>
                      <TableCell>
                        {student.confirmed
                          ? percent(
                              student.correct / student.confirmed,
                            )
                          : "—"}
                      </TableCell>
                      {admin&&<TableCell><StudentTeacher id={student.id} value={student.teacherId??''} onSaved={rows.reload} teachers={teachers.data?.teachers??[]} disabled={teachers.loading||!!teachers.error}/></TableCell>}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex gap-3 items-center mt-4">
          <Button variant="outline" disabled={page===0||rows.loading} onClick={()=>setPage(p=>p-1)}>Trang trước</Button>
          <span className="small muted">Trang {page+1}</span>
          <Button variant="outline" disabled={rows.loading||!rows.data||rows.data.nextOffset===null} onClick={()=>setPage(p=>p+1)}>Trang sau</Button>
        </div>
      </Card>
    </>
  );
}
function TeacherSelect({value,onChange,disabled=false,teachers}:{value:string;onChange:(value:string)=>void;disabled?:boolean;teachers:{id:string;label:string}[]}) {
  return <div className="field"><Label>Giáo viên phụ trách<select className="w-full rounded-lg border bg-background p-2 mt-2" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>
    <option value="">Chưa giao giáo viên</option>
    {teachers.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
    {value&&!teachers.some(t=>t.id===value)&&<option value={value}>{value}</option>}
  </select></Label></div>;
}
function StudentTeacher({id,value,onSaved,teachers,disabled}:{id:string;value:string;onSaved:()=>void;teachers:{id:string;label:string}[];disabled:boolean}) {
  const {api}=useAuth();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function assign(next:string){setBusy(true);setError('');try{await api.assignTeacher(id,next||null);onSaved();}catch(e){setError(e instanceof Error?e.message:'Chưa thể giao học sinh.');}finally{setBusy(false);}}
  return <><TeacherSelect value={value} onChange={assign} disabled={busy||disabled} teachers={teachers}/>{error&&<Notice tone="error">{error}</Notice>}</>;
}
