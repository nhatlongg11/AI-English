import {useEffect,useState,type FormEvent} from 'react';
import {toast} from 'sonner';
import {Link} from 'react-router-dom';
import {useAuth} from '../auth/context';
import {useResource} from '../../hooks/use-resource';
import {EmptyState,Loading,Notice,PageHeading,ResourceError} from '../../components/common';
import {Card} from '../../components/ui/card';
import {Button} from '../../components/ui/button';
import {Input} from '../../components/ui/input';
import {Label} from '../../components/ui/label';
import {Pager,RosterPicker,studentLabel} from './ClassroomShared';
import type {AttendanceStatus,LessonDetail} from '../../types';

export const attendanceLabels:Record<AttendanceStatus,string>={unmarked:'Chưa điểm danh',present:'Có mặt',absent:'Vắng',late:'Đi muộn',excused:'Có phép'};
export function Attendance(){
  const {api}=useAuth();const [page,setPage]=useState(0);const [selected,setSelected]=useState('');const [title,setTitle]=useState('');
  const [date,setDate]=useState(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
  const [students,setStudents]=useState<string[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const resource=useResource(`lessons:${page}`,()=>api.lessons(page*30));
  const [dirty,setDirty]=useState(false);
  async function create(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const result=await api.createLesson({title:title.trim(),heldOn:date,studentIds:students});setSelected(result.lesson.id);setTitle('');setStudents([]);setPage(0);resource.reload();toast.success('Đã mở sổ điểm danh. Các em chưa được đánh dấu có mặt.');}catch(e){setError(e instanceof Error?e.message:'Chưa tạo được buổi học.');}finally{setBusy(false);}}
  return <><PageHeading title="Điểm danh buổi học" description="Chọn buổi học và ghi nhận có mặt, đi muộn hoặc vắng. Đăng nhập vào app không tự tính là có mặt."/><Button asChild variant="outline" className="mb-6"><Link to="/teacher/lesson-reports">Báo cáo điểm danh, bài tập & điểm số</Link></Button>
    {api.demo&&<Notice>Đăng nhập bằng mã giáo viên để lưu điểm danh thật.</Notice>}
    <div className="two-col"><Card className="panel" data-guide="lesson-create"><h2>Tạo buổi học</h2><form className="stack" onSubmit={create}>
      <div className="field"><Label htmlFor="lesson-title">Tên buổi học</Label><Input id="lesson-title" required maxLength={120} placeholder="Ví dụ: Ôn thì hiện tại đơn — buổi 1" value={title} onChange={e=>setTitle(e.target.value)}/></div>
      <div className="field"><Label htmlFor="lesson-date">Ngày học</Label><Input id="lesson-date" required type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
      <RosterPicker selected={students} onChange={setStudents}/>{error&&<Notice tone="error">{error}</Notice>}
      <Button disabled={api.demo||busy||dirty||!title.trim()||!date||!students.length}>{busy?'Đang tạo…':'Tạo sổ điểm danh'}</Button>
    </form></Card><Card className="panel" data-guide="lesson-list"><h2>Các buổi học</h2>
      {resource.loading?<Loading/>:resource.error?<ResourceError message={resource.error} retry={resource.reload}/>:!resource.data?.lessons.length?<EmptyState title="Chưa có buổi học" description="Tạo buổi học đầu tiên ở bên cạnh, rồi điểm danh cho từng em."/>:<div className="stack">{resource.data.lessons.map(l=><Button className="h-auto text-left justify-start whitespace-normal py-3" key={l.id} disabled={dirty&&selected!==l.id} variant={selected===l.id?'secondary':'outline'} onClick={()=>setSelected(l.id)}><span>{l.title}<small className="block muted">{l.heldOn.split('-').reverse().join('/')} · Đã điểm danh {l.marked}/{l.total}</small></span></Button>)}</div>}
      <Pager page={page} setPage={setPage} loading={resource.loading} hasNext={resource.data?.nextOffset!=null}/>
    </Card></div>{dirty&&<Notice>Hãy lưu hoặc hủy thay đổi điểm danh trước khi chuyển buổi học.</Notice>}{selected&&<AttendanceDetail key={selected} id={selected} onSaved={resource.reload} onDirty={setDirty}/>}</>;
}
function AttendanceDetail({id,onSaved,onDirty}:{id:string;onSaved:()=>void;onDirty:(dirty:boolean)=>void}){
  const {api}=useAuth();const resource=useResource(`lesson:${id}`,()=>api.lesson(id));
  if(resource.loading)return <Loading/>;if(resource.error||!resource.data)return <ResourceError message={resource.error??'Chưa tải được sổ.'} retry={resource.reload}/>;
  return <Register key={JSON.stringify(resource.data.lesson.records)} lesson={resource.data.lesson} onSaved={()=>{resource.reload();onSaved();}} onDirty={onDirty}/>;
}
function Register({lesson,onSaved,onDirty}:{lesson:LessonDetail;onSaved:()=>void;onDirty:(dirty:boolean)=>void}){
  const {api}=useAuth();const [values,setValues]=useState<Record<string,AttendanceStatus>>(()=>Object.fromEntries(lesson.records.map(r=>[r.studentId,r.status])));
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const dirty=lesson.records.some(r=>r.status!==values[r.studentId]);
  useEffect(()=>{onDirty(dirty);const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};if(dirty)window.addEventListener('beforeunload',warn);return ()=>{onDirty(false);window.removeEventListener('beforeunload',warn);};},[dirty,onDirty]);
  async function save(){if(busy)return;setBusy(true);setError('');try{await api.markAttendance(lesson.id,lesson.records.filter(r=>r.status!==values[r.studentId]).map(r=>({studentId:r.studentId,status:values[r.studentId]})));toast.success('Đã lưu điểm danh.');onSaved();}catch(e){setError(e instanceof Error?e.message:'Chưa lưu được điểm danh.');}finally{setBusy(false);}}
  return <Card className="panel mt-6" data-guide="attendance-register"><div className="flex flex-wrap gap-3 justify-between"><div><h2>{lesson.title}</h2><p className="small muted">{lesson.heldOn.split('-').reverse().join('/')} · {lesson.records.length} học sinh</p></div><Button disabled={busy||!dirty} onClick={save}>{busy?'Đang lưu…':'Lưu điểm danh'}</Button></div>
    {!lesson.records.length&&<Notice>Không còn học sinh bạn phụ trách trong buổi học này.</Notice>}
    <div className="stack mt-4">{lesson.records.map(record=><div key={record.studentId} className="attendance-row"><div><strong>{studentLabel(record.student)}</strong><p className="small muted">{record.studentId.slice(0,12)}{record.markedAt?` · Đã lưu ${new Date(record.markedAt).toLocaleString('vi-VN')}`:' · Chưa có ghi nhận'}</p></div><label className="small">Điểm danh {studentLabel(record.student)}<select className="classroom-select" disabled={busy} value={values[record.studentId]} onChange={e=>setValues(v=>({...v,[record.studentId]:e.target.value as AttendanceStatus}))}>{Object.entries(attendanceLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>)}</div>
    {dirty&&<div className="flex flex-wrap gap-3 items-center mt-3"><p className="small muted">Có thay đổi chưa lưu. Bấm Lưu điểm danh trước khi chuyển buổi.</p><Button variant="outline" disabled={busy} onClick={()=>setValues(Object.fromEntries(lesson.records.map(r=>[r.studentId,r.status])))}>Hủy thay đổi</Button></div>}{error&&<Notice tone="error">{error}</Notice>}
  </Card>;
}
