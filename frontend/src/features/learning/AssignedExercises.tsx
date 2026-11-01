import {useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {useAuth} from '../auth/context';
import {useResource} from '../../hooks/use-resource';
import {EmptyState,Loading,Notice,PageHeading,ResourceError} from '../../components/common';
import {Card} from '../../components/ui/card';
import {Button} from '../../components/ui/button';
import {Textarea} from '../../components/ui/textarea';
import {Label} from '../../components/ui/label';
import {Pager} from '../teacher/ClassroomShared';
import type {Feedback} from '../../types';
import {normalizeAnswer} from '../../lib/utils';
import {AnswerHelp} from '../ai/AnswerHelp';

export function AssignedExercises(){
  const {api}=useAuth();const [page,setPage]=useState(0);const resource=useResource(`student-exercises:${page}`,()=>api.exercises(page*30,true));
  return <><PageHeading title="Bài thầy cô giao" description="Các bài tập dành cho bạn. Kết quả được lưu sau mỗi câu, nên bạn có thể quay lại làm tiếp." action={<Button variant="outline" onClick={resource.reload}>Cập nhật danh sách</Button>}/>
    {api.demo&&<Notice>Đây là giao diện mẫu. Đăng nhập bằng mã học sinh thật để nhận bài thầy cô giao.</Notice>}
    {resource.loading?<Loading/>:resource.error?<ResourceError message={resource.error} retry={resource.reload}/>:!resource.data?.exercises.length?<EmptyState title="Chưa có bài được giao" description="Khi thầy cô giao bài, bạn sẽ thấy ở đây. Bạn vẫn có thể luyện tập trong góc học tập." action={<Button asChild><Link to="/student/practice">Luyện tập thêm</Link></Button>}/>:<div className="topic-grid">{resource.data.exercises.map(e=><Card key={e.id} className="panel"><h2>{e.title}</h2><p className="muted whitespace-pre-wrap my-3">{e.instructions}</p><p>{e.answered??0}/{e.questionCount} câu đã nộp</p><p className="small muted">{e.correct??0} câu đúng · {e.pending??0} câu chờ kiểm tra</p><Button asChild className="mt-4"><Link to={`/student/exercises/${e.id}`}>{e.answered===e.questionCount?'Xem hoàn thành':e.answered?'Làm tiếp':'Bắt đầu làm bài'}</Link></Button></Card>)}</div>}
    <Pager page={page} setPage={setPage} loading={resource.loading} hasNext={resource.data?.nextOffset!=null}/></>;
}
export function AssignedExercisePlayer(){
  const {id}=useParams();return <ExercisePlayer key={id} id={id!}/>;
}
function ExercisePlayer({id}:{id:string}){
  const {api}=useAuth();const resource=useResource(`assigned-exercise:${id}`,()=>api.exerciseNext(id));
  const [answer,setAnswer]=useState('');const [feedback,setFeedback]=useState<Feedback|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);
  async function submit(){const decision=resource.data?.decisionId;if(!decision||!answer.trim()||lock.current||feedback)return;lock.current=true;setBusy(true);setError('');try{setFeedback(await api.submit(decision,{answer}));}catch(e){setError(e instanceof Error?e.message:'Chưa nộp được câu trả lời.');}finally{lock.current=false;setBusy(false);}}
  function next(){setAnswer('');setFeedback(null);setError('');resource.reload();}
  if(resource.loading)return <Loading/>;if(resource.error||!resource.data)return <ResourceError message={resource.error??'Chưa tải được bài tập.'} retry={resource.reload}/>;
  const result=resource.data;const q=result.question;
  return <><PageHeading title={result.exercise.title} description={result.exercise.instructions||'Làm từng câu và đọc giải thích. Tiến độ được lưu tự động.'}/>
    <Button asChild variant="outline" className="mb-5"><Link to="/student/exercises">Về danh sách bài tập</Link></Button>
    {result.completed||!q?<Card className="panel"><h2>Bạn đã hoàn thành bài tập!</h2><p className="mt-3">Đã nộp {result.exercise.answered}/{result.exercise.total} câu. Thầy cô có thể xem kết quả của bạn.</p></Card>:<Card className="question-card"><p className="small muted">Câu {result.exercise.answered+1}/{result.exercise.total}</p><h2 className="sentence" lang="en">{q.content}</h2>
      {q.questionType==='multiple_choice'?<div className="options-grid" role="group" aria-label="Các đáp án">{q.options.map((option,i)=><button type="button" key={i} className={`answer-card ${answer===option?'selected':''} ${feedback&&normalizeAnswer(option)===normalizeAnswer(feedback.correctAnswer)?'correct':''} ${feedback?.correct===false&&answer===option?'wrong':''}`} aria-label={`${String.fromCharCode(65+i)}. ${option}`} aria-pressed={answer===option} disabled={busy||!!feedback} onClick={()=>setAnswer(option)}><span className="answer-letter">{String.fromCharCode(65+i)}.</span><span lang="en">{option}</span></button>)}</div>:<div className="field"><Label htmlFor="assigned-answer">{q.questionType==='fill_in_blank'?'Phần còn thiếu':'Câu đã sửa của bạn'}</Label><Textarea id="assigned-answer" value={answer} maxLength={300} disabled={busy||!!feedback} onChange={e=>setAnswer(e.target.value)}/></div>}
      {error&&<Notice tone="error">{error}</Notice>}
      {feedback?<div className="stack" role="status"><h3>{feedback.correct===true?'Chính xác!':feedback.correct===false?'Cùng xem lại nhé':'Câu trả lời cần kiểm tra thêm'}</h3><p lang="en">{feedback.correctAnswer}</p><p>{feedback.explanationVi}</p>{feedback.correct===null&&<p className="small muted">Câu này đang chờ kiểm tra, không bị tính sai.</p>}{feedback.attemptId&&<AnswerHelp key={feedback.attemptId} attemptId={feedback.attemptId}/>}<Button onClick={next}>{result.exercise.answered+1===result.exercise.total?'Xem hoàn thành':'Câu tiếp theo'}</Button></div>:<Button disabled={busy||!answer.trim()} onClick={submit}>{busy?'Đang nộp…':'Nộp câu trả lời'}</Button>}
    </Card>}</>;
}
