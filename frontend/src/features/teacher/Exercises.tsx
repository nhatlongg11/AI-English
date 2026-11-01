import {useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,ArrowRight,BookOpen,Check,ClipboardCheck,FileText,Plus,Users} from 'lucide-react';
import {toast} from 'sonner';
import {useAuth} from '../auth/context';
import {useResource} from '../../hooks/use-resource';
import {EmptyState,Loading,Notice,PageHeading,ResourceError} from '../../components/common';
import {Card} from '../../components/ui/card';
import {Button} from '../../components/ui/button';
import {Badge} from '../../components/ui/badge';
import {Pager,studentLabel} from './ClassroomShared';
import {ExerciseComposer} from './ExerciseComposer';
import type {ExerciseDetail} from '../../types';

export function Exercises(){
  const {api}=useAuth();const [page,setPage]=useState(0);const [selected,setSelected]=useState('');
  const [editor,setEditor]=useState<{exercise?:ExerciseDetail}|null>(null);
  const [message,setMessage]=useState('');
  const resource=useResource(`teacher-exercises:${page}`,()=>api.exercises(page*30));
  function saved(id:string,published:boolean){setEditor(null);setSelected(id);setPage(0);setMessage(published?'Bài đã được giao. Học sinh có thể mở mục Bài thầy cô giao để bắt đầu.':'Đã lưu bản nháp. Học sinh chưa nhận bài; bạn có thể chỉnh sửa và giao sau.');resource.reload();}
  function start(){setSelected('');setMessage('');setEditor({});}
  return <><PageHeading title={editor?editor.exercise?'Chỉnh sửa bài nháp':'Tạo bài tập mới':selected?'Chi tiết bài tập':'Giao bài tập'} description="Chọn học sinh → Chọn câu hỏi → Đặt tên bài → Kiểm tra & giao." action={!editor&&!selected?<Button onClick={start} disabled={api.demo}><Plus size={16}/>Tạo bài tập mới</Button>:undefined}/>
    {selected&&!editor&&<Button variant="ghost" className="mb-5" onClick={()=>{setSelected('');setMessage('');}}><ArrowLeft size={16}/>Danh sách bài tập</Button>}
    {api.demo&&<Notice>Đăng nhập bằng mã thật để tạo và giao bài cho học sinh.</Notice>}
    {editor&&<ExerciseComposer key={editor.exercise?.id??'new'} exercise={editor.exercise} onSaved={saved} onCancel={()=>setEditor(null)}/>}
    {!editor&&!selected&&<>
    <div className="exercise-intro"><span className="exercise-intro-icon"><ClipboardCheck size={24}/></span><div><h2>Giao đúng bài, đúng học sinh</h2><p>Bắt đầu bằng việc chọn người nhận. Bạn sẽ được xem lại toàn bộ bài trước khi gửi.</p><div className="exercise-intro-steps"><span><Users size={14}/>Chọn học sinh</span><ArrowRight size={13}/><span><BookOpen size={14}/>Chọn câu hỏi</span><ArrowRight size={13}/><span><FileText size={14}/>Đặt tên & giao</span></div></div></div>
    <Card className="panel mt-6" data-guide="exercise-list"><div className="flex items-center justify-between gap-3"><h2>Bài tập của bạn</h2><span className="small muted">Chọn một bài để xem hoặc tiếp tục chỉnh sửa</span></div>
      {resource.loading?<Loading/>:resource.error?<ResourceError message={resource.error} retry={resource.reload}/>:!resource.data?.exercises.length?<EmptyState title="Giao bài tập đầu tiên" description="Chuẩn bị một bài mới theo từng bước. Chỉ những học sinh bạn chọn mới nhận được bài."
        action={<Button className="mt-4" onClick={start} disabled={api.demo}>Tạo bài tập đầu tiên<ArrowRight size={16}/></Button>}/>:<div className="exercise-list">{resource.data.exercises.map(e=><button type="button" className="exercise-list-item" key={e.id} onClick={()=>{setSelected(e.id);setMessage('');}}><span className="exercise-list-icon">{e.publishedAt?<Check size={20}/>:<FileText size={20}/>}</span><span className="min-w-0 flex-1 text-left"><strong>{e.title}</strong><small>{e.questionCount} câu hỏi · {e.studentCount??0} học sinh · {e.publishedAt?'Học sinh đã nhận bài':'Học sinh chưa nhận bài'}</small></span><Badge variant={e.publishedAt?'secondary':'outline'}>{e.publishedAt?'Đã giao':'Bản nháp'}</Badge><ArrowRight size={17}/></button>)}</div>}
      <Pager page={page} setPage={setPage} loading={resource.loading} hasNext={resource.data?.nextOffset!=null}/>
    </Card></>}
    {message&&!editor&&<Notice>{message}</Notice>}
    {selected&&!editor&&<ExerciseDetails key={selected} id={selected} onEdit={exercise=>{setMessage('');setEditor({exercise});}} onPublished={resource.reload}/>}</>;
}
function ExerciseDetails({id,onEdit,onPublished}:{id:string;onEdit:(exercise:ExerciseDetail)=>void;onPublished:()=>void}){
  const {api}=useAuth();const resource=useResource(`exercise-detail:${id}`,()=>api.exercise(id));const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function publish(){if(busy)return;setBusy(true);setError('');try{await api.publishExercise(id);toast.success('Đã giao bài. Học sinh sẽ thấy trong Bài thầy cô giao.');resource.reload();onPublished();}catch(e){setError(e instanceof Error?e.message:'Chưa giao được bài.');}finally{setBusy(false);}}
  if(resource.loading)return <Loading/>;if(resource.error||!resource.data)return <ResourceError message={resource.error??'Chưa tải được bài tập.'} retry={resource.reload}/>;
  const e=resource.data.exercise;const blocked=e.questions.some(q=>q.question.status!=='approved');
  return <Card className="panel mt-6" data-guide="exercise-detail"><div className="flex flex-wrap justify-between gap-3"><div><h2>{e.title}</h2><p className="small muted">{e.publishedAt?'Đã giao cho học sinh':'Bản nháp · Học sinh chưa nhận được'}</p></div><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={resource.reload}>Cập nhật kết quả</Button>{!e.publishedAt&&<><Button variant="outline" disabled={busy} onClick={()=>onEdit(e)}>Sửa bản nháp</Button><Button disabled={busy||blocked||!e.recipients.length} onClick={publish}>{busy?'Đang giao…':'Giao bài cho học sinh'}</Button></>}</div></div>
    {e.instructions&&<p className="my-4 whitespace-pre-wrap">{e.instructions}</p>}
    {blocked&&!e.publishedAt&&<Notice>Có câu đang chờ duyệt hoặc đã bị từ chối. Nhờ quản trị viên kiểm tra trong <Link to="/teacher/question-bank" className="underline">Ngân hàng câu hỏi</Link>, rồi cập nhật lại trang. Bài chưa được giao cho học sinh.</Notice>}
    <details className="exercise-delivery-content" open={!e.publishedAt}><summary>{e.questions.length} câu hỏi trong bài — xem nội dung</summary><ol className="stack my-4">{e.questions.map((q,i)=><li key={q.questionId}><strong>Câu {i+1}.</strong> <span lang="en">{q.question.content}</span> <small className="muted">· {q.question.status==='approved'?'Đã duyệt':q.question.status==='rejected'?'Đã từ chối':'Chờ duyệt'}</small></li>)}</ol></details>
    <h3>{e.publishedAt?'Tiến độ học sinh':'Học sinh sẽ nhận bài'}</h3><div className="stack mt-3">{e.recipients.map(r=><div className="exercise-progress-row" key={r.studentId}>
      <div className="min-w-0"><strong>{r.student.displayName||'Chưa nhập tên'}</strong><span className="block small muted">{r.student.className||'Chưa nhập lớp'}</span><span className="exercise-student-code">{studentLabel(r.student)}</span></div>
      {e.publishedAt?<div className="exercise-progress-result"><Badge variant={r.answered>=e.questions.length?'secondary':'outline'}>{r.answered>=e.questions.length?'Hoàn thành':r.answered>0?'Đang làm':'Chưa bắt đầu'}</Badge><progress value={r.answered} max={Math.max(1,e.questions.length)} aria-label={`Tiến độ ${r.student.displayName||r.studentId}`}/><span className="small muted">{r.answered}/{e.questions.length} câu đã nộp · {r.correct} đúng{r.pending>0?` · ${r.pending} chờ kiểm tra`:''}</span></div>:<Badge variant="outline">Chưa nhận bài</Badge>}
    </div>)}</div>{!e.recipients.length&&<Notice>Không có học sinh bạn phụ trách trong bài này.</Notice>}
    {error&&<Notice tone="error">{error}</Notice>}
  </Card>;
}
