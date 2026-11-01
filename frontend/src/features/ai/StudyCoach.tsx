import {useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../auth/context';
import {useResource} from '../../hooks/use-resource';
import {Choice,Loading,Notice,PageHeading,ResourceError} from '../../components/common';
import {Card} from '../../components/ui/card';
import {Button} from '../../components/ui/button';
import {AiSource,SignalSummary} from './Shared';
import {topic} from '../../lib/grammar';
import type {StudyPlanResult} from '../../types-ai';

export function StudyCoach(){
  const {api,session}=useAuth();const saved=useResource(`study-plan:${session?.actorId}`,()=>api.supportHistory('study_plan'));
  const [days,setDays]=useState<3|7>(3);const [minutes,setMinutes]=useState('10');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [generated,setGenerated]=useState<StudyPlanResult|null>(null);
  const result=generated??saved.data?.items[0];
  async function create(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{setGenerated(await api.studyPlan(days,Number(minutes)));}catch(e){setError(e instanceof Error?e.message:'Chưa tạo được kế hoạch.');}finally{setBusy(false);}}
  return <><PageHeading title="Cố vấn học tập AI" description="Một kế hoạch nhỏ dựa trên những câu bạn đã làm, để biết hôm nay nên ôn gì."/>
    <Card className="panel" data-guide="ai-coach"><form onSubmit={create} className="stack"><div className="flex flex-wrap gap-4"><Choice label="Lập kế hoạch cho" value={String(days)} onChange={v=>setDays(Number(v) as 3|7)} options={[{value:'3',label:'3 ngày tới'},{value:'7',label:'7 ngày tới'}]}/><Choice label="Thời gian mỗi ngày" value={minutes} onChange={setMinutes} options={['5','10','15','20','30'].map(v=>({value:v,label:`${v} phút`}))}/></div><p className="small muted">Chỉ tạo khi bạn bấm nút. Kế hoạch đã lưu có thể xem lại mà không gọi AI thêm; kết quả học mới sẽ được dùng khi bạn tạo lại.</p><Button disabled={busy||api.demo}>{busy?'AI đang chuẩn bị kế hoạch…':'Tạo kế hoạch với AI'}</Button></form>{error&&<Notice tone="error">{error}</Notice>}{api.demo&&<Notice>Đăng nhập bằng mã học sinh thật để tạo kế hoạch từ tiến độ của bạn.</Notice>}</Card>
    {saved.loading&&!result?<Loading/>:saved.error&&!result?<ResourceError message={saved.error} retry={saved.reload}/>:!result?<Card className="panel mt-6"><h2>Bắt đầu từ một mục tiêu nhỏ</h2><p className="muted mt-3">Chọn số ngày và thời gian ở trên. Nếu bạn chưa làm bài, AI sẽ gợi ý kế hoạch làm quen và ghi rõ chưa có dữ liệu tiến độ.</p></Card>:<div className="mt-6" data-guide="ai-plan"><AiSource result={result}/><SignalSummary statistics={result.context.statistics}/>{result.context.basis==='starter_plan'&&<Notice>Chưa có kết quả đã chấm. Đây là kế hoạch làm quen, chưa phải đánh giá sức học.</Notice>}<Card className="panel my-5"><h2>{result.data.summaryVi}</h2><p className="muted mt-3">{result.context.days} ngày · {result.context.minutesPerDay} phút/ngày</p></Card><div className="topic-grid">{result.data.days.map(day=><Card className="panel" key={day.day}><p className="small muted">Ngày {day.day} · {topic(day.tense).vi}</p><h3 className="my-3">{day.goalVi}</h3><p>{day.activityVi}</p><div className="flex flex-wrap gap-2 mt-4"><Button asChild variant="outline"><Link to={`/student/grammar/${day.tense}`}>Xem bài học</Link></Button>{result.context.statistics.availableContent.some(c=>c.tense===day.tense&&c.count>0)?<Button asChild><Link to={`/student/practice?adaptive=1&tense=${day.tense}`}>Luyện tập</Link></Button>:<p className="small muted">Thầy cô đang bổ sung bài luyện cho chủ đề này.</p>}</div></Card>)}</div><p className="mt-5 muted">{result.data.encouragementVi}</p></div>}
  </>;
}
