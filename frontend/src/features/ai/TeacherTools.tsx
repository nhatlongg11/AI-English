import {useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../auth/context';
import {useResource} from '../../hooks/use-resource';
import {Choice,Notice,PageHeading,ResourceError} from '../../components/common';
import {Card} from '../../components/ui/card';
import {Button} from '../../components/ui/button';
import {AiSource,SignalSummary} from './Shared';
import {topics,errors,topic} from '../../lib/grammar';
import type {Tense} from '../../types';
import type {LessonPlanResult,InsightsResult} from '../../types-ai';

export function TeacherAiTools(){
  return <><PageHeading title="Trợ lý giảng dạy AI" description="Chuẩn bị giáo án và tìm điều cần ôn từ kết quả học sinh. Bạn kiểm tra và quyết định cách dạy."/><div className="stack"><LessonPlanner/><ClassAdvisor/></div></>;
}
function LessonPlanner(){
  const {api,session}=useAuth();const history=useResource(`lesson-plans:${session?.actorId}`,()=>api.supportHistory('lesson_plan'));
  const [tense,setTense]=useState<Tense>('present_simple');const [difficulty,setDifficulty]=useState('1');const [minutes,setMinutes]=useState('45');const [focus,setFocus]=useState('any');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [generated,setGenerated]=useState<LessonPlanResult|null>(null);const result=generated??history.data?.items[0];
  async function create(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{setGenerated(await api.lessonPlan({tense,difficulty:Number(difficulty),minutes:Number(minutes) as 30|45|60,focusError:focus==='any'?null:focus}));}catch(e){setError(e instanceof Error?e.message:'Chưa soạn được giáo án.');}finally{setBusy(false);}}
  return <Card className="panel" data-guide="ai-lesson-plan"><h2>Soạn giáo án cùng AI</h2><p className="muted my-3">Chọn mục tiêu và thời lượng. AI đề xuất trình tự hoạt động, cách hỗ trợ và củng cố bài.</p><form onSubmit={create} className="stack"><div className="flex flex-wrap gap-3">
    <Choice label="Chủ đề giáo án" value={tense} onChange={v=>setTense(v as Tense)} options={topics.map(t=>({value:t.id,label:t.vi}))}/>
    <Choice label="Độ khó giáo án" value={difficulty} onChange={setDifficulty} options={[1,2,3,4,5].map(v=>({value:String(v),label:`Mức ${v}/5`}))}/>
    <Choice label="Thời lượng buổi học" value={minutes} onChange={setMinutes} options={['30','45','60'].map(v=>({value:v,label:`${v} phút`}))}/>
    <Choice label="Điểm cần tập trung" value={focus} onChange={setFocus} options={[{value:'any',label:'Ôn cấu trúc chung'},...Object.entries(errors).map(([value,label])=>({value,label}))]}/>
  </div><Button disabled={busy||api.demo}>{busy?'AI đang soạn giáo án…':'Tạo giáo án với AI'}</Button></form>
  {api.demo&&<Notice>Đăng nhập bằng mã giáo viên thật để dùng Gemini.</Notice>}{error&&<Notice tone="error">{error}</Notice>}{history.error&&!result&&<ResourceError message={history.error} retry={history.reload}/>}
  {result&&<div className="mt-5"><AiSource result={result}/><h3>{result.data.titleVi}</h3><p className="small muted my-3">{topic(result.context.tense).vi} · Mức {result.context.difficulty}/5 · {result.context.minutes} phút</p><ul className="list-disc pl-5 mb-4">{result.data.objectivesVi.map((o,i)=><li key={i}>{o}</li>)}</ul><div className="stack">{result.data.activities.map((activity,i)=><div className="detail-box" key={i}><h3>{i+1}. {activity.titleVi} · {activity.minutes} phút</h3><p className="mt-2 whitespace-pre-wrap">{activity.instructionsVi}</p></div>)}</div><div className="two-col mt-4"><div><h3>Hỗ trợ học sinh cần luyện thêm</h3><p>{result.data.supportVi}</p></div><div><h3>Mở rộng cho học sinh làm tốt</h3><p>{result.data.extensionVi}</p></div></div><h3 className="mt-4">Kiểm tra cuối buổi</h3><p>{result.data.assessmentVi}</p><Notice>Đây là giáo án gợi ý. Nội dung không tự tạo câu trong kho hoặc tự giao bài. Câu hỏi vẫn cần admin duyệt.</Notice><Button asChild variant="outline" className="mt-4"><Link to={`/teacher/ai-studio?tense=${result.context.tense}&difficulty=${result.context.difficulty}${result.context.focusError?`&target=${result.context.focusError}`:''}`}>Soạn câu hỏi theo giáo án</Link></Button></div>}
  </Card>;
}
function ClassAdvisor(){
  const {api,session}=useAuth();const history=useResource(`class-insights:${session?.actorId}`,()=>api.supportHistory('class_insights'));
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [generated,setGenerated]=useState<InsightsResult|null>(null);const result=generated??history.data?.items[0];
  async function analyse(){if(busy)return;setBusy(true);setError('');try{setGenerated(await api.classInsights());}catch(e){setError(e instanceof Error?e.message:'Chưa nhận xét được kết quả.');}finally{setBusy(false);}}
  return <Card className="panel" data-guide="ai-teaching-insights"><h2>Buổi tới nên ôn gì?</h2><p className="muted my-3">AI đọc thống kê tối đa 500 lượt gần nhất của {session?.role==='admin'?'toàn hệ thống':'học sinh bạn phụ trách'}, rồi gợi ý cách củng cố. Không gửi tên, lớp, mã đăng nhập hoặc câu trả lời nguyên văn cho AI.</p><Button disabled={busy||api.demo} onClick={analyse}>{busy?'AI đang xem kết quả…':'Nhờ AI gợi ý nội dung ôn tập'}</Button>{error&&<Notice tone="error">{error}</Notice>}{history.error&&!result&&<ResourceError message={history.error} retry={history.reload}/>}
  {result&&<div className="mt-5"><AiSource result={result}/><SignalSummary statistics={result.context.statistics}/><p className="small muted">{result.context.statistics.activeStudents}/{result.context.statistics.registeredStudents} học sinh có hoạt động trong phần dữ liệu này.</p><h3 className="my-3">{result.data.summaryVi}</h3><div className="stack">{result.data.priorities.map((p,i)=><div className="detail-box" key={i}><h3>{topic(p.tense).vi}{p.errorCode?` · ${errors[p.errorCode]??p.errorCode}`:''}</h3><p className="my-2">{p.reasonVi}</p><p>{p.teachingActionVi}</p><Button asChild variant="outline" className="mt-3"><Link to={`/teacher/ai-studio?tense=${p.tense}${p.errorCode?`&target=${p.errorCode}`:''}`}>Soạn câu ôn tập</Link></Button></div>)}</div><p className="mt-4">{result.data.nextLessonVi}</p><p className="small muted mt-3">Các gợi ý không phải kết luận về hiệu quả dạy học hay mức tiến bộ. Xem số liệu gốc trong <Link className="underline" to="/teacher/analytics">Phân tích học tập</Link>.</p></div>}
  </Card>;
}
