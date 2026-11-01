import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,ArrowRight,BookOpen,Check,ClipboardCheck,FileText,Send,Users} from 'lucide-react';
import {toast} from 'sonner';
import {useAuth} from '../auth/context';
import {useResource} from '../../hooks/use-resource';
import {Notice,ResourceError} from '../../components/common';
import {Card} from '../../components/ui/card';
import {Button} from '../../components/ui/button';
import {Input} from '../../components/ui/input';
import {Label} from '../../components/ui/label';
import {Textarea} from '../../components/ui/textarea';
import {Badge} from '../../components/ui/badge';
import {ManualQuestion} from './QuestionAuthoring';
import {assignmentBank,assignmentRoster,ExerciseQuestions,ExerciseRecipients} from './ExercisePickers';
import {topic} from '../../lib/grammar';
import {questionTypeLabels} from '../../lib/question-files';
import type {BankQuestion,ExerciseDetail,ExerciseInput} from '../../types';

const steps=[
  {title:'Chọn học sinh',description:'Ai sẽ nhận bài?',icon:Users},
  {title:'Chọn câu hỏi',description:'Học sinh sẽ làm gì?',icon:BookOpen},
  {title:'Đặt tên bài',description:'Tên bài và lời dặn',icon:FileText},
  {title:'Kiểm tra & giao',description:'Xem lại trước khi gửi',icon:ClipboardCheck},
];

export function ExerciseComposer({exercise,onSaved,onCancel}:{
  exercise?:ExerciseDetail;onSaved:(id:string,published:boolean)=>void;onCancel:()=>void;
}) {
  const {api,session}=useAuth();
  const [step,setStep]=useState(0);
  const [furthest,setFurthest]=useState(0);
  const [title,setTitle]=useState(exercise?.title??'');
  const [instructions,setInstructions]=useState(exercise?.instructions??'');
  const [students,setStudents]=useState(exercise?.recipients.map(recipient=>recipient.studentId)??[]);
  const [questions,setQuestions]=useState(exercise?.questions.map(question=>question.questionId)??[]);
  const [cached,setCached]=useState<BankQuestion[]>([]);
  const [manual,setManual]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const persisted=useRef<{id:string;signature:string}|null>(exercise?{id:exercise.id,signature:JSON.stringify({title:exercise.title,instructions:exercise.instructions,studentIds:students,questionIds:questions})}:null);
  const submitting=useRef(false);
  const heading=useRef<HTMLHeadingElement>(null);
  const panel=useRef<HTMLDivElement>(null);
  const roster=useResource(`assignment-students:${session?.actorId}`,()=>assignmentRoster(api));
  const bank=useResource(`assignment-questions:${session?.actorId}`,()=>assignmentBank(api));
  const allQuestions=[...new Map([
    ...(exercise?.questions.map(item=>item.question)??[]),...cached,...(bank.data??[]),
  ].map(question=>[question.id,question])).values()];
  const selectedQuestions=questions.map(id=>allQuestions.find(question=>question.id===id));
  const selectedStudents=students.map(id=>roster.data?.find(student=>student.id===id)??exercise?.recipients.find(recipient=>recipient.studentId===id)?.student);
  const pending=selectedQuestions.filter(question=>question?.status==='draft').length;
  const invalid=selectedQuestions.some(question=>!question||question.status==='rejected');
  const missingStudent=Boolean(roster.data)&&students.some(id=>!roster.data!.some(student=>student.id===id));
  const valid=[students.length>0&&!roster.loading&&!roster.error&&!missingStudent,
    questions.length>0&&!bank.loading&&!bank.error&&!invalid,title.trim().length>0,true];
  const canPublish=valid.slice(0,3).every(Boolean)&&pending===0&&!api.demo;
  const dirty=title!==(exercise?.title??'')||instructions!==(exercise?.instructions??'')
    ||JSON.stringify(students)!==JSON.stringify(exercise?.recipients.map(recipient=>recipient.studentId)??[])
    ||JSON.stringify(questions)!==JSON.stringify(exercise?.questions.map(question=>question.questionId)??[]);
  useEffect(()=>{
    panel.current?.scrollIntoView({block:'start',behavior:'auto'});
    heading.current?.focus({preventScroll:true});
  },[step]);
  useEffect(()=>{
    if(!dirty)return;
    const leave=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);
  },[dirty]);

  function go(next:number) {
    if(busy||next<0||next>3||!valid.slice(0,next).every(Boolean))return;
    setStep(next);setFurthest(previous=>Math.max(previous,next));setError('');
  }
  function selectQuestions(ids:string[]) {
    setCached(previous=>[...new Map([...previous,...allQuestions.filter(question=>ids.includes(question.id))].map(question=>[question.id,question])).values()]);
    setQuestions(ids);
  }
  async function save(publish:boolean) {
    if(submitting.current||!valid.slice(0,3).every(Boolean)||api.demo||(publish&&!canPublish))return;
    submitting.current=true;setBusy(true);setError('');
    const payload:ExerciseInput={title:title.trim(),instructions:instructions.trim(),studentIds:students,questionIds:questions};
    const signature=JSON.stringify(payload);
    try {
      if(persisted.current?.signature!==signature) {
        const result=await api.saveExercise(payload,persisted.current?.id??exercise?.id);
        persisted.current={id:result.exercise.id,signature};
      }
      const id=persisted.current!.id;
      if(publish)await api.publishExercise(id);
      toast.success(publish?`Đã giao bài cho ${students.length} học sinh.`:'Đã lưu bản nháp. Học sinh chưa nhận bài.');
      onSaved(id,publish);
    } catch(reason) {
      const message=reason instanceof Error?reason.message:'Chưa lưu được bài tập. Hãy thử lại.';
      setError(publish&&persisted.current?.signature===signature
        ?`Bản nháp đã được lưu. Chưa xác nhận giao bài: ${message} Bạn có thể thử giao lại.`:message);
    } finally {submitting.current=false;setBusy(false);}
  }
  const help=step===0?(missingStudent?'Có học sinh không còn trong danh sách phụ trách. Hãy bỏ chọn hoặc tải lại.':'Chọn ít nhất 1 học sinh để tiếp tục.')
    :step===1?(invalid?'Bỏ các câu đã bị từ chối hoặc không còn trong ngân hàng để tiếp tục.':'Chọn ít nhất 1 câu hỏi để tiếp tục.')
      :'Nhập tên bài tập để tiếp tục.';

  return <Card ref={panel} className="panel exercise-composer" data-guide="exercise-compose">
    <nav aria-label="Các bước giao bài tập"><ol className="exercise-steps">{steps.map((item,index)=>{
      const Icon=item.icon;
      return <li key={item.title} className={index===step?'active':index<step?'complete':''}>
        <button type="button" disabled={busy||index>furthest||!valid.slice(0,index).every(Boolean)} aria-current={index===step?'step':undefined} onClick={()=>go(index)}>
          <span className="exercise-step-number">{index<step?<Check size={17}/>:index+1}</span><span><strong>{item.title}</strong><small>{item.description}</small></span><Icon className="exercise-step-icon" size={18}/>
        </button>
      </li>;
    })}</ol></nav>
    <div className="exercise-step-heading"><p className="exercise-eyebrow">BƯỚC {step+1} / 4</p><h2 ref={heading} tabIndex={-1}>{steps[step]!.title}</h2><p className="muted">{[
      'Chọn lớp, rồi chọn các học sinh sẽ nhận bài tập này.',
      'Chọn câu đã duyệt trong ngân hàng. Bạn có thể đổi thứ tự trước khi giao.',
      'Đặt tên dễ nhận biết để học sinh tìm đúng bài trong mục Bài thầy cô giao.',
      'Kiểm tra người nhận và nội dung. Bài chỉ xuất hiện cho học sinh khi bạn bấm Giao bài ngay.',
    ][step]}</p></div>
    <form onSubmit={event=>{event.preventDefault();if(step<3)go(step+1);}}>
      <div className="exercise-step-content">
        {step===0&&<ExerciseRecipients resource={roster} selected={students} onChange={setStudents}/>}
        {step===1&&<ExerciseQuestions resource={bank} allQuestions={allQuestions} selected={questions} onChange={selectQuestions} onManual={()=>setManual(true)} demo={api.demo}/>}
        {step===2&&<div className="exercise-name-form stack">
          <div className="field"><Label htmlFor="exercise-title">Tên bài tập <span className="text-destructive">*</span></Label><Input id="exercise-title" required maxLength={120} value={title} onChange={event=>setTitle(event.target.value)} placeholder="Ví dụ: Hiện tại đơn — Lớp 8A1 — Tuần 1"/><p className="small muted">Học sinh sẽ nhìn thấy tên này trong danh sách bài được giao.</p></div>
          <div className="field"><Label htmlFor="exercise-instructions">Lời dặn học sinh <span className="muted">(không bắt buộc)</span></Label><Textarea id="exercise-instructions" maxLength={2000} rows={4} value={instructions} onChange={event=>setInstructions(event.target.value)} placeholder="Ví dụ: Làm lần lượt từng câu và đọc giải thích sau khi nộp."/></div>
          <div className="exercise-name-example"><FileText size={20}/><div><span className="small muted">HỌC SINH SẼ THẤY</span><strong>{title.trim()||'Tên bài tập của bạn'}</strong><p>{questions.length} câu hỏi · Bài thầy cô giao</p></div></div>
        </div>}
        {step===3&&<div className="stack">
          <div className="exercise-review-title"><span className="exercise-ready-icon"><ClipboardCheck size={24}/></span><div><h3>{title.trim()}</h3><p className="small muted">{questions.length} câu hỏi · {students.length} học sinh nhận bài</p></div><Badge variant="outline">{bank.error?'Chưa kiểm tra được':bank.loading?'Đang cập nhật':pending?'Cần duyệt câu hỏi':invalid?'Cần kiểm tra câu hỏi':'Sẵn sàng giao'}</Badge></div>
          {instructions.trim()&&<div className="exercise-instructions-preview"><span className="small muted">LỜI DẶN HỌC SINH</span><p>{instructions.trim()}</p></div>}
          <div className="exercise-review-grid">
            <section className="exercise-review-section"><div className="flex items-center justify-between gap-3"><h3>Người nhận · {students.length}</h3><Button type="button" size="sm" variant="ghost" onClick={()=>go(0)}>Đổi học sinh</Button></div><div className="exercise-recipient-tags">{selectedStudents.map((student,index)=><span key={students[index]}>{student?.displayName||'Chưa nhập tên'}<small>{student?.className||'Chưa nhập lớp'}</small></span>)}</div></section>
            <section className="exercise-review-section"><div className="flex items-center justify-between gap-3"><h3>Câu hỏi · {questions.length}</h3><Button type="button" size="sm" variant="ghost" onClick={()=>go(1)}>Đổi câu hỏi</Button></div><ol className="exercise-review-questions">{selectedQuestions.map((question,index)=><li key={questions[index]}><span className="exercise-order">{index+1}</span><div><p lang="en">{question?.content}</p><small className="muted">{question?questionTypeLabels[question.questionType]:''} · {question?topic(question.tense).vi:''}</small>{question?.status!=='approved'&&<span className="block small text-destructive">Chờ quản trị viên duyệt</span>}</div></li>)}</ol></section>
          </div>
          {bank.error?<ResourceError message={bank.error} retry={bank.reload}/>:pending>0?<Notice tone="warning"><div><p>{pending} câu hỏi đang chờ duyệt. Bạn có thể lưu bản nháp; hãy nhờ quản trị viên duyệt trong <Link to="/teacher/question-bank" target="_blank" rel="noopener noreferrer" className="underline">Ngân hàng câu hỏi</Link> trước khi giao.</p><Button type="button" variant="outline" size="sm" className="mt-3" disabled={bank.loading||busy} onClick={bank.reload}>{bank.loading?'Đang cập nhật…':'Cập nhật trạng thái câu hỏi'}</Button></div></Notice>:bank.loading?<Notice>Đang cập nhật trạng thái câu hỏi…</Notice>:invalid?<Notice tone="warning">Có câu hỏi không còn sử dụng được. Quay lại bước Chọn câu hỏi để kiểm tra.</Notice>:<div className="exercise-ready-message"><Check size={17}/>Tất cả câu hỏi đã được duyệt. Học sinh có thể nhận bài ngay.</div>}
        </div>}
      </div>
      {error&&<Notice tone="error">{error}</Notice>}
      <div className="exercise-wizard-footer">
        <div><strong>{students.length} học sinh · {questions.length} câu hỏi</strong>{step<3&&!valid[step]&&<p className="small muted" role="status">{help}</p>}</div>
        <div className="exercise-footer-buttons">
          {step>0&&<Button type="button" className="exercise-back-button" variant="outline" disabled={busy} onClick={()=>go(step-1)}><ArrowLeft size={16}/>Quay lại</Button>}
          {step<3?<Button type="button" className="exercise-next-button" disabled={!valid[step]||busy||api.demo} onClick={()=>go(step+1)}>Tiếp tục: {steps[step+1]!.title}<ArrowRight size={16}/></Button>:<>
            <Button type="button" variant="outline" disabled={busy||!valid.slice(0,3).every(Boolean)||api.demo} onClick={()=>save(false)}><FileText size={16}/>{busy?'Đang lưu…':'Lưu bản nháp'}</Button>
            <Button type="button" disabled={busy||!canPublish} onClick={()=>save(true)}><Send size={16}/>{busy?'Đang xử lý…':'Giao bài ngay'}</Button>
          </>}
        </div>
      </div>
    </form>
    <Button type="button" variant="ghost" className="self-start" disabled={busy} onClick={onCancel}>Hủy {exercise?'chỉnh sửa':'tạo bài'}</Button>
    {manual&&<ManualQuestion onClose={()=>setManual(false)} onSaved={items=>{
      setManual(false);setCached(previous=>[...previous,...items]);setQuestions(previous=>[...new Set([...previous,...items.map(item=>item.id)])].slice(0,100));bank.reload();
      toast.success('Đã thêm câu mới vào bài. Câu này cần được quản trị viên duyệt trước khi giao.');
    }}/>}
  </Card>;
}
