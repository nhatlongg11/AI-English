import {useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {toast} from 'sonner';
import {useAuth} from '../auth/context';
import {useResource} from '../../hooks/use-resource';
import {EmptyState,Loading,Notice,PageHeading,ResourceError} from '../../components/common';
import {Card} from '../../components/ui/card';
import {Button} from '../../components/ui/button';
import {Input} from '../../components/ui/input';
import {Label} from '../../components/ui/label';
import {Textarea} from '../../components/ui/textarea';
import {Pager,RosterPicker,studentLabel,toggleId} from './ClassroomShared';
import {ManualQuestion} from './QuestionAuthoring';
import type {ExerciseDetail} from '../../types';

export function Exercises(){
  const {api}=useAuth();const [page,setPage]=useState(0);const [selected,setSelected]=useState('');
  const [editor,setEditor]=useState<{exercise?:ExerciseDetail}|null>({});
  const resource=useResource(`teacher-exercises:${page}`,()=>api.exercises(page*30));
  function saved(id:string){setEditor(null);setSelected(id);setPage(0);resource.reload();}
  return <><PageHeading title="Bài tập giao cho học sinh" description="Tự soạn hoặc chọn câu trong kho, ghép thành bài và giao cho từng em." action={<Button onClick={()=>setEditor({})}>Tạo bài tập mới</Button>}/>
    {api.demo&&<Notice>Đăng nhập bằng mã thật để tạo và giao bài cho học sinh.</Notice>}
    {editor&&<ExerciseComposer key={editor.exercise?.id??'new'} exercise={editor.exercise} onSaved={saved} onCancel={()=>setEditor(null)}/>}
    <Card className="panel mt-6" data-guide="exercise-list"><h2>Bài đã chuẩn bị</h2>
      {resource.loading?<Loading/>:resource.error?<ResourceError message={resource.error} retry={resource.reload}/>:!resource.data?.exercises.length?<EmptyState title="Chưa có bài tập" description="Chọn Tạo bài tập mới để bắt đầu. Bản nháp chưa xuất hiện ở phía học sinh."/>:<div className="stack">{resource.data.exercises.map(e=><Button className="h-auto text-left justify-start whitespace-normal py-3" variant={selected===e.id?'secondary':'outline'} key={e.id} onClick={()=>{setSelected(e.id);setEditor(null);}}><span>{e.title}<small className="block muted">{e.publishedAt?'Đã giao':'Bản nháp'} · {e.questionCount} câu · {e.studentCount} học sinh</small></span></Button>)}</div>}
      <Pager page={page} setPage={setPage} loading={resource.loading} hasNext={resource.data?.nextOffset!=null}/>
    </Card>{selected&&!editor&&<ExerciseDetails key={selected} id={selected} onEdit={exercise=>setEditor({exercise})} onPublished={resource.reload}/>}</>;
}
function ExerciseComposer({exercise,onSaved,onCancel}:{exercise?:ExerciseDetail;onSaved:(id:string)=>void;onCancel:()=>void}){
  const {api}=useAuth();const [title,setTitle]=useState(exercise?.title??'');const [instructions,setInstructions]=useState(exercise?.instructions??'');
  const [students,setStudents]=useState(exercise?.recipients.map(r=>r.studentId)??[]);const [questions,setQuestions]=useState(exercise?.questions.map(q=>q.questionId)??[]);
  const [page,setPage]=useState(0);const [search,setSearch]=useState('');const [manual,setManual]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const bank=useResource(`exercise-bank:${page}`,()=>api.questions(`offset=${page*100}`));
  const available=bank.data?.questions.filter(q=>q.status!=='rejected'&&q.content.toLowerCase().includes(search.toLowerCase()))??[];
  async function save(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const result=await api.saveExercise({title:title.trim(),instructions:instructions.trim(),studentIds:students,questionIds:questions},exercise?.id);toast.success('Đã lưu bài nháp. Kiểm tra nội dung rồi bấm Giao bài.');onSaved(result.exercise.id);}catch(e){setError(e instanceof Error?e.message:'Chưa lưu được bài tập.');}finally{setBusy(false);}}
  return <Card className="panel" data-guide="exercise-compose"><h2>{exercise?'Chỉnh sửa bài nháp':'Chuẩn bị bài tập'}</h2><form className="stack" onSubmit={save}>
    <div className="field"><Label htmlFor="exercise-title">Tên bài tập</Label><Input id="exercise-title" required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ví dụ: Luyện hiện tại đơn — tuần 1"/></div>
    <div className="field"><Label htmlFor="exercise-instructions">Lời dặn học sinh (không bắt buộc)</Label><Textarea id="exercise-instructions" maxLength={2000} value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="Đọc kỹ câu hỏi và xem lại giải thích sau mỗi câu nhé."/></div>
    <div className="two-col"><fieldset className="stack"><legend className="font-semibold">Chọn câu hỏi · {questions.length}/100</legend>
      <Button type="button" variant="outline" disabled={api.demo} onClick={()=>setManual(true)}>Tự soạn câu hỏi cho bài này</Button>
      <p className="small muted">Câu tự soạn sẽ chờ quản trị viên duyệt. Thứ tự chọn là thứ tự học sinh làm bài.</p>
      <Input aria-label="Tìm câu hỏi cho bài tập" placeholder="Tìm nội dung trong trang này…" value={search} onChange={e=>setSearch(e.target.value)}/>
      {bank.loading?<Loading/>:bank.error?<ResourceError message={bank.error} retry={bank.reload}/>:!available.length?<EmptyState title="Chưa có câu hỏi phù hợp" description="Tự soạn câu mới hoặc tìm trong trang khác."/>:<div className="selection-list">{available.map(q=><label key={q.id} className="selection-row"><input type="checkbox" checked={questions.includes(q.id)} disabled={!questions.includes(q.id)&&questions.length>=100} onChange={()=>setQuestions(toggleId(questions,q.id))}/><span><span lang="en">{q.content}</span><small className="block muted">{q.status==='approved'?'Đã duyệt':'Chờ quản trị viên duyệt'}{questions.includes(q.id)?` · Câu ${questions.indexOf(q.id)+1}`:''}</small></span></label>)}</div>}
      <Pager page={page} setPage={setPage} loading={bank.loading} hasNext={(bank.data?.questions.length??0)===100}/>
    </fieldset><RosterPicker selected={students} onChange={setStudents}/></div>
    {error&&<Notice tone="error">{error}</Notice>}<div className="flex gap-3"><Button disabled={api.demo||busy||!title.trim()||!students.length||!questions.length}>{busy?'Đang lưu…':'Lưu bài nháp'}</Button><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Đóng</Button></div>
  </form>{manual&&<ManualQuestion onClose={()=>setManual(false)} onSaved={created=>{setManual(false);setQuestions(previous=>[...new Set([...previous,...created.map(q=>q.id)])].slice(0,100));setPage(0);setSearch('');bank.reload();}}/>}</Card>;
}
function ExerciseDetails({id,onEdit,onPublished}:{id:string;onEdit:(exercise:ExerciseDetail)=>void;onPublished:()=>void}){
  const {api}=useAuth();const resource=useResource(`exercise-detail:${id}`,()=>api.exercise(id));const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function publish(){if(busy)return;setBusy(true);setError('');try{await api.publishExercise(id);toast.success('Đã giao bài. Học sinh sẽ thấy trong Bài thầy cô giao.');resource.reload();onPublished();}catch(e){setError(e instanceof Error?e.message:'Chưa giao được bài.');}finally{setBusy(false);}}
  if(resource.loading)return <Loading/>;if(resource.error||!resource.data)return <ResourceError message={resource.error??'Chưa tải được bài tập.'} retry={resource.reload}/>;
  const e=resource.data.exercise;const blocked=e.questions.some(q=>q.question.status!=='approved');
  return <Card className="panel mt-6" data-guide="exercise-detail"><div className="flex flex-wrap justify-between gap-3"><div><h2>{e.title}</h2><p className="small muted">{e.publishedAt?'Đã giao cho học sinh':'Bản nháp · Học sinh chưa nhận được'}</p></div><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={resource.reload}>Cập nhật kết quả</Button>{!e.publishedAt&&<><Button variant="outline" disabled={busy} onClick={()=>onEdit(e)}>Sửa bản nháp</Button><Button disabled={busy||blocked||!e.recipients.length} onClick={publish}>{busy?'Đang giao…':'Giao bài cho học sinh'}</Button></>}</div></div>
    {e.instructions&&<p className="my-4 whitespace-pre-wrap">{e.instructions}</p>}
    {blocked&&!e.publishedAt&&<Notice>Có câu đang chờ duyệt hoặc đã bị từ chối. Nhờ quản trị viên kiểm tra trong <Link to="/teacher/question-bank" className="underline">Ngân hàng câu hỏi</Link>, rồi cập nhật lại trang. Bài chưa được giao cho học sinh.</Notice>}
    <ol className="stack my-4">{e.questions.map((q,i)=><li key={q.questionId}><strong>Câu {i+1}.</strong> <span lang="en">{q.question.content}</span> <small className="muted">· {q.question.status==='approved'?'Đã duyệt':q.question.status==='rejected'?'Đã từ chối':'Chờ duyệt'}</small></li>)}</ol>
    <h3>{e.publishedAt?'Học sinh đã làm đến đâu?':'Học sinh sẽ nhận bài'}</h3><div className="stack mt-3">{e.recipients.map(r=><div className="attendance-row" key={r.studentId}><span>{studentLabel(r.student)}<small className="block muted">{r.studentId.slice(0,12)}</small></span><span className="small">{e.publishedAt?`${r.answered}/${e.questions.length} câu đã nộp · ${r.correct} đúng · ${r.pending} chờ kiểm tra`:'Chưa giao'}</span></div>)}</div>{!e.recipients.length&&<Notice>Không có học sinh bạn phụ trách trong bài này.</Notice>}
    {error&&<Notice tone="error">{error}</Notice>}
  </Card>;
}
