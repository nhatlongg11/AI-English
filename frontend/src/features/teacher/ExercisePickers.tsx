import {useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowDown,ArrowUp,BookOpen,Check,Search,X} from 'lucide-react';
import {EmptyState,Loading,Notice,ResourceError} from '../../components/common';
import {Button} from '../../components/ui/button';
import {Input} from '../../components/ui/input';
import {Label} from '../../components/ui/label';
import {Badge} from '../../components/ui/badge';
import {topics,topic} from '../../lib/grammar';
import {questionTypeLabels} from '../../lib/question-files';
import {studentLabel} from '../../lib/student-identity';
import {Pager,toggleId} from './ClassroomShared';
import type {BankQuestion,ClassroomStudent} from '../../types';
import type {ApiClient} from '../../services/api';

export const selectionLimit=100;
export const searchText=(text:string)=>text.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLocaleLowerCase();

export async function assignmentRoster(api:ApiClient) {
  const students:ClassroomStudent[]=[];
  let offset=0;
  while(true) {
    const result=await api.students(offset);
    students.push(...result.students.map(student=>({...student,displayName:student.displayName??null,teacherId:student.teacherId??null})));
    if(result.nextOffset==null)break;
    if(result.nextOffset<=offset)throw new Error('Không thể tải đầy đủ danh sách học sinh. Hãy thử lại.');
    offset=result.nextOffset;
  }
  return [...new Map(students.map(student=>[student.id,student])).values()];
}

export async function assignmentBank(api:ApiClient) {
  const questions:BankQuestion[]=[];
  for(let offset=0;;offset+=100) {
    const result=await api.questions(`offset=${offset}`);
    questions.push(...result.questions);
    if(result.questions.length<100)break;
  }
  return [...new Map(questions.map(question=>[question.id,question])).values()];
}

export interface PickerResource<T> {data?:T;loading:boolean;error?:string;reload:()=>void}

export function ExerciseRecipients({resource,selected,onChange}:{
  resource:PickerResource<ClassroomStudent[]>;selected:string[];onChange:(ids:string[])=>void;
}) {
  const [className,setClassName]=useState('all');
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(0);
  const all=resource.data??[];
  const classes=[...new Set(all.map(student=>student.className?.trim()||''))].sort((a,b)=>a.localeCompare(b,'vi'));
  const matching=all.filter(student=>(className==='all'||(student.className?.trim()||'')===className)
    &&searchText(`${student.displayName??''} ${student.className??''} ${studentLabel(student)}`).includes(searchText(search.trim())));
  const unselected=matching.filter(student=>!selected.includes(student.id));
  const overLimit=selected.length+unselected.length>selectionLimit;
  const visible=matching.slice(page*20,(page+1)*20);
  if(resource.loading)return <Loading/>;
  if(resource.error)return <ResourceError message={resource.error} retry={resource.reload}/>;
  if(!all.length)return <EmptyState title="Bạn chưa có học sinh để giao bài" description="Thêm học sinh hoặc nhờ quản trị viên phân công lớp cho bạn, rồi quay lại bước này."
    action={<Button asChild className="mt-4"><Link to="/teacher/students">Mở mục Học sinh</Link></Button>}/>;
  return <div className="stack">
    <div className="exercise-filters">
      <div className="field"><Label htmlFor="exercise-class">Lớp nhận bài</Label><select id="exercise-class" value={className} onChange={event=>{setClassName(event.target.value);setPage(0);}}>
        <option value="all">Tất cả lớp</option>{classes.map(value=><option key={value} value={value}>{value||'Chưa có thông tin lớp'}</option>)}
      </select></div>
      <div className="field exercise-search"><Label htmlFor="exercise-student-search">Tìm học sinh</Label><div className="exercise-search-input"><Search size={16}/><Input id="exercise-student-search" placeholder="Tên, lớp hoặc mã học sinh" value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}}/></div></div>
    </div>
    <div className="exercise-selection-toolbar">
      <span><strong>{selected.length}</strong> học sinh đã chọn <span className="muted">/ tối đa 100</span></span>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={!unselected.length||overLimit} onClick={()=>onChange([...selected,...unselected.map(student=>student.id)])}>{className!=='all'&&!search.trim()?'Chọn cả lớp':'Chọn tất cả kết quả'} ({matching.length})</Button>
        {selected.length>0&&<Button type="button" variant="ghost" size="sm" onClick={()=>onChange([])}>Bỏ chọn tất cả</Button>}</div>
    </div>
    {overLimit&&<Notice>Danh sách này vượt quá 100 học sinh mỗi bài. Hãy chọn một lớp hoặc chia thành các nhóm nhỏ hơn.</Notice>}
    {!matching.length?<EmptyState title="Không tìm thấy học sinh" description="Thử tìm tên khác hoặc chọn Tất cả lớp. Những học sinh đã chọn vẫn được giữ."/>:<div className="exercise-student-grid">{visible.map(student=><label key={student.id} className={`exercise-student ${selected.includes(student.id)?'selected':''}`}>
      <input type="checkbox" checked={selected.includes(student.id)} disabled={!selected.includes(student.id)&&selected.length>=selectionLimit} onChange={()=>onChange(toggleId(selected,student.id))}/>
      <span className="exercise-student-avatar" aria-hidden="true">{(student.displayName?.trim()||'?').split(/\s+/).at(-1)?.slice(0,1).toLocaleUpperCase()}</span>
      <span className="min-w-0"><strong>{student.displayName||'Chưa nhập họ tên'}</strong><span className="block small muted">{student.className||'Chưa nhập lớp'}</span><span className="exercise-student-code">{studentLabel(student)}</span></span>
    </label>)}</div>}
    {matching.length>20&&<Pager page={page} setPage={setPage} hasNext={(page+1)*20<matching.length}/>}
    <p className="small muted">Bạn có thể chọn thêm học sinh ở lớp khác. Các lựa chọn được giữ khi đổi lớp hoặc tìm kiếm.</p>
  </div>;
}

export function ExerciseQuestions({resource,allQuestions,selected,onChange,onManual,demo}:{
  resource:PickerResource<BankQuestion[]>;allQuestions:BankQuestion[];selected:string[];
  onChange:(ids:string[])=>void;onManual:()=>void;demo:boolean;
}) {
  const [tense,setTense]=useState('all');
  const [format,setFormat]=useState('all');
  const [difficulty,setDifficulty]=useState('all');
  const [search,setSearch]=useState('');
  const [showDrafts,setShowDrafts]=useState(false);
  const [page,setPage]=useState(0);
  const chosen=selected.map(id=>allQuestions.find(question=>question.id===id));
  const matching=allQuestions.filter(question=>question.status!=='rejected'&&(showDrafts||question.status==='approved')
    &&(tense==='all'||question.tense===tense)&&(format==='all'||question.questionType===format)
    &&(difficulty==='all'||question.difficulty===Number(difficulty))
    &&searchText(`${question.content} ${question.errorCode}`).includes(searchText(search.trim())))
    .sort((a,b)=>a.difficulty-b.difficulty||topics.findIndex(item=>item.id===a.tense)-topics.findIndex(item=>item.id===b.tense)||a.content.localeCompare(b.content,'en'));
  function move(index:number,direction:number) {
    const next=[...selected];
    [next[index],next[index+direction]]=[next[index+direction]!,next[index]!];onChange(next);
  }
  function resetFilters(){setTense('all');setFormat('all');setDifficulty('all');setSearch('');setPage(0);}
  return <div className="exercise-question-layout">
    <div className="stack min-w-0">
      <div className="exercise-filters">
        <div className="field"><Label htmlFor="exercise-tense">Thì ngữ pháp</Label><select id="exercise-tense" value={tense} onChange={event=>{setTense(event.target.value);setPage(0);}}><option value="all">Tất cả các thì</option>{topics.map(item=><option key={item.id} value={item.id}>{item.vi}</option>)}</select></div>
        <div className="field"><Label htmlFor="exercise-format">Dạng câu hỏi</Label><select id="exercise-format" value={format} onChange={event=>{setFormat(event.target.value);setPage(0);}}><option value="all">Tất cả dạng bài</option>{Object.entries(questionTypeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
        <div className="field"><Label htmlFor="exercise-difficulty">Độ khó</Label><select id="exercise-difficulty" value={difficulty} onChange={event=>{setDifficulty(event.target.value);setPage(0);}}><option value="all">Tất cả mức độ</option>{[1,2,3,4,5].map(value=><option key={value} value={value}>Mức {value}/5</option>)}</select></div>
      </div>
      <div className="exercise-search-input"><Search size={16}/><Input aria-label="Tìm câu hỏi cho bài tập" placeholder="Tìm trong toàn bộ ngân hàng câu hỏi…" value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}}/></div>
      <div className="exercise-selection-toolbar"><span className="small muted">{matching.length} câu phù hợp</span><Button type="button" size="sm" variant="outline" onClick={onManual} disabled={demo||selected.length>=selectionLimit}>Tự soạn câu mới</Button></div>
      {resource.loading?<Loading/>:resource.error?<ResourceError message={resource.error} retry={resource.reload}/>:!matching.length?<EmptyState title="Chưa có câu hỏi phù hợp" description={!allQuestions.some(question=>question.status==='approved')&&allQuestions.some(question=>question.status==='draft')?'Bạn có câu đang chờ duyệt. Mở Ngân hàng câu hỏi để duyệt, hoặc bật Hiện câu chờ duyệt để chuẩn bị bản nháp.':'Thử bỏ bớt bộ lọc hoặc bổ sung câu hỏi vào ngân hàng.'}
        action={<div className="flex flex-wrap gap-2 justify-center mt-4"><Button type="button" variant="outline" onClick={resetFilters}>Xóa bộ lọc</Button><Button asChild variant="outline"><Link to="/teacher/question-bank" target="_blank" rel="noopener noreferrer">Ngân hàng câu hỏi</Link></Button></div>}/>:<div className="exercise-bank-list">{matching.slice(page*8,(page+1)*8).map(question=><article key={question.id} className={`exercise-question ${selected.includes(question.id)?'selected':''}`}>
        <label><input type="checkbox" checked={selected.includes(question.id)} disabled={!selected.includes(question.id)&&selected.length>=selectionLimit} onChange={()=>onChange(toggleId(selected,question.id))}/><span><span className="exercise-question-meta">{topic(question.tense).vi} · {questionTypeLabels[question.questionType]} · Mức {question.difficulty}/5</span><span className="block mt-2" lang="en">{question.content}</span><span className="exercise-question-state">{question.status==='approved'?<><Check size={13}/>Đã duyệt — sẵn sàng giao</>:'Chờ duyệt — chỉ lưu nháp'}{selected.includes(question.id)&&<strong> · Câu {selected.indexOf(question.id)+1}</strong>}</span></span></label>
        <details><summary>Xem đáp án & giải thích</summary><strong lang="en">{question.correctAnswer}</strong><p>{question.explanationVi}</p></details>
      </article>)}</div>}
      {matching.length>8&&<Pager page={page} setPage={setPage} loading={resource.loading} hasNext={(page+1)*8<matching.length}/>}
      <label className="exercise-draft-toggle"><input type="checkbox" checked={showDrafts} onChange={event=>{setShowDrafts(event.target.checked);setPage(0);}}/>Hiện cả câu chờ duyệt để chuẩn bị bản nháp</label>
    </div>
    <aside className="exercise-selected" aria-label="Thứ tự câu hỏi đã chọn">
      <div className="flex items-center gap-2"><BookOpen size={18}/><h3>Nội dung bài tập</h3><Badge variant="secondary">{selected.length}/100</Badge></div>
      <p className="small muted">Học sinh sẽ làm theo thứ tự dưới đây. Dùng mũi tên để sắp xếp lại.</p>
      {!selected.length?<div className="exercise-selected-empty"><BookOpen size={24}/><p>Chọn câu hỏi trong ngân hàng để thêm vào bài.</p></div>:<ol className="exercise-selected-list">{chosen.map((question,index)=><li key={selected[index]}>
        <span className="exercise-order">{index+1}</span><div className="min-w-0"><p lang="en">{question?.content??'Câu hỏi không còn trong ngân hàng'}</p>{question?.status!=='approved'&&<span className="small text-destructive">{question?.status==='rejected'?'Đã bị từ chối — hãy bỏ câu này':'Cần quản trị viên duyệt'}</span>}
          <div className="exercise-order-actions"><Button type="button" size="icon" variant="ghost" disabled={index===0} aria-label={`Đưa câu ${index+1} lên`} onClick={()=>move(index,-1)}><ArrowUp size={14}/></Button><Button type="button" size="icon" variant="ghost" disabled={index===chosen.length-1} aria-label={`Đưa câu ${index+1} xuống`} onClick={()=>move(index,1)}><ArrowDown size={14}/></Button><Button type="button" size="sm" variant="ghost" aria-label={`Bỏ câu ${index+1}`} onClick={()=>onChange(selected.filter(id=>id!==selected[index]))}><X size={13}/>Bỏ</Button></div>
        </div>
      </li>)}</ol>}
      <div className="exercise-selection-total"><BookOpen size={15}/><span className="small">Tối đa 100 câu trong một bài tập.</span></div>
    </aside>
  </div>;
}
