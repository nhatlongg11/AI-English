import {useEffect,useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {CheckCircle2,Clock3,MinusCircle,Printer,SquarePen} from 'lucide-react';
import {toast} from 'sonner';
import {useAuth} from '../auth/context';
import {useResource} from '../../hooks/use-resource';
import {EmptyState,Loading,Notice,PageHeading,ResourceError} from '../../components/common';
import {Button} from '../../components/ui/button';
import {Card} from '../../components/ui/card';
import {Input} from '../../components/ui/input';
import {Label} from '../../components/ui/label';
import {Pager,toggleId} from './ClassroomShared';
import {attendanceLabels} from './Attendance';
import type {AttendanceStatus,HomeworkStatus,LessonDetail,LessonReportInput} from '../../types';
import './lesson-reports.css';

export const homeworkLabels:Record<HomeworkStatus,string>={unmarked:'Chưa kiểm tra',complete:'Đầy đủ',partial:'Một phần',missing:'Cần bổ sung'};
const scoreText=(value:number)=>value.toLocaleString('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:1});
const shortDate=(date:string)=>date.split('-').reverse().join('/');
const reportName=(student:LessonDetail['records'][number]['student'])=>student.displayName||`Học sinh ${student.id.slice(0,8)}`;
export function reportStatistics(lesson:LessonDetail){
  const records=lesson.records;
  const vocabulary=records.flatMap(r=>r.vocabularyKnown===null||lesson.vocabularyTotal===null?[]:[{name:reportName(r.student),score:r.vocabularyKnown/lesson.vocabularyTotal*10}]);
  const miniTest=records.filter(r=>r.miniTestScore!==null).map(r=>({name:reportName(r.student),score:r.miniTestScore!}));
  const scores=(values:{name:string;score:number}[])=>{const best=values.length?Math.max(...values.map(r=>r.score)):null;return {count:values.length,average:values.length?values.reduce((sum,r)=>sum+r.score,0)/values.length:null,best,leaders:values.filter(r=>r.score===best).map(r=>r.name)};};
  return {total:records.length,present:records.filter(r=>r.status==='present'||r.status==='late').length,late:records.filter(r=>r.status==='late').length,excused:records.filter(r=>r.status==='excused').length,absent:records.filter(r=>r.status==='absent').length,unmarked:records.filter(r=>r.status==='unmarked').length,complete:records.filter(r=>r.homeworkStatus==='complete').length,partial:records.filter(r=>r.homeworkStatus==='partial').length,missing:records.filter(r=>r.homeworkStatus==='missing').length,unchecked:records.filter(r=>r.homeworkStatus==='unmarked').length,vocabulary:scores(vocabulary),miniTest:scores(miniTest)};
}

export function LessonReports(){
  const {api}=useAuth();const [page,setPage]=useState(0);const [selected,setSelected]=useState<string[]>([]);const [editing,setEditing]=useState<string|null>(null);
  const list=useResource(`report-list:${page}`,()=>api.lessons(page*30));
  const reports=useResource(`reports:${selected.join(',')}`,()=>Promise.all(selected.map(id=>api.lesson(id))).then(results=>results.map(r=>r.lesson).sort((a,b)=>a.heldOn.localeCompare(b.heldOn)||a.title.localeCompare(b.title,'vi'))));
  return <div className="lesson-report-page">
    {editing&&<p className="report-print-warning">Báo cáo đang có thay đổi chưa lưu. Hãy lưu hoặc hủy thay đổi rồi in lại.</p>}
    <div className="report-controls"><PageHeading title="Báo cáo buổi học" description="Gộp điểm danh, bài tập và điểm số thành bản báo cáo dễ đọc để gửi phụ huynh."/>
      <Card className="panel mb-6" data-guide="report-picker"><div className="report-picker-heading"><div><h2>Chọn buổi học để báo cáo</h2><p className="small muted">Chọn tối đa 10 buổi, kể cả ở trang khác. Dữ liệu được lấy từ sổ đã lưu.</p></div><Button asChild variant="outline"><Link to="/teacher/attendance">Tạo buổi học / điểm danh</Link></Button></div>
        {api.demo&&<Notice>Đăng nhập bằng mã giáo viên để xem báo cáo thật.</Notice>}
        {list.loading?<Loading/>:list.error?<ResourceError message={list.error} retry={list.reload}/>:!list.data?.lessons.length?<EmptyState title="Chưa có buổi học" description="Tạo buổi học và chọn học sinh trong mục Điểm danh để bắt đầu."/>:<div className="report-lesson-options">{list.data.lessons.map(lesson=><label key={lesson.id}><input type="checkbox" checked={selected.includes(lesson.id)} disabled={!!editing||(!selected.includes(lesson.id)&&selected.length>=10)} onChange={()=>setSelected(ids=>toggleId(ids,lesson.id))}/><span><strong>{lesson.title}</strong><small>{shortDate(lesson.heldOn)}{lesson.reportClassName?` · ${lesson.reportClassName}`:''} · {lesson.total} học sinh</small></span></label>)}</div>}
        <Pager page={page} setPage={setPage} loading={list.loading} hasNext={list.data?.nextOffset!=null}/>
      </Card>
      <div className="report-toolbar"><p className="small muted">Đã chọn {selected.length}/10 buổi · Điểm trống được giữ riêng, không tính là 0.</p><Button onClick={()=>setSelected([])} variant="ghost" disabled={!selected.length||!!editing}>Bỏ chọn tất cả</Button><Button onClick={()=>window.print()} disabled={!selected.length||reports.loading||!!reports.error||!!editing}><Printer size={16}/>In / Lưu PDF</Button></div>
      <p className="small muted mb-4">Trước khi chia sẻ: báo cáo có họ tên và kết quả cả lớp. Chỉ gửi cho người được phép xem.</p>
    </div>
    {selected.length===0?<div className="report-controls"><EmptyState title="Báo cáo bắt đầu từ buổi học của bạn" description="Chọn một hoặc nhiều buổi ở trên để xem báo cáo và nhập kết quả."/></div>:reports.loading?<Loading/>:reports.error?<ResourceError message={reports.error} retry={reports.reload}/>:<>
      <header className="report-cover"><span className="report-kicker">TENSELAB · THEO DÕI TIẾN BỘ</span><h1>Báo cáo học tập{reports.data?.length&&reports.data.length>1?' hằng tuần':''}</h1><p>Điểm danh, bài tập về nhà và từ vựng</p><small>{reports.data?.map(l=>shortDate(l.heldOn)).filter((d,i,a)=>a.indexOf(d)===i).join(' · ')}</small></header>
      {reports.data?.map(lesson=>editing===lesson.id?<ReportEditor key={lesson.id} lesson={lesson} onCancel={()=>setEditing(null)} onSaved={()=>{setEditing(null);reports.reload();list.reload();}}/>:<LessonReport key={lesson.id} lesson={lesson} editing={!!editing} onEdit={()=>setEditing(lesson.id)}/>)}
    </>}
  </div>;
}

function AttendanceBadge({status}:{status:AttendanceStatus}){
  const Icon=status==='present'?CheckCircle2:status==='late'?Clock3:MinusCircle;
  return <span className={`report-status status-${status}`}><Icon size={16}/>{status==='excused'?'Vắng có phép':attendanceLabels[status]}</span>;
}
function HomeworkBadge({status}:{status:HomeworkStatus}){
  const Icon=status==='complete'?CheckCircle2:MinusCircle;
  return <span className={`report-status homework-${status}`}><Icon size={16}/>{homeworkLabels[status]}</span>;
}
function Score({score}:{score:number|null}){
  return score===null?<span className="report-no-score">Chưa có điểm</span>:<span className="report-score"><span className="report-meter" role="meter" aria-label="Điểm trên 10" aria-valuenow={score} aria-valuemin={0} aria-valuemax={10}><span style={{width:`${score*10}%`}}/></span><strong>{scoreText(score)}</strong></span>;
}
function ScoreSummary({title,stats}:{title:string;stats:ReturnType<typeof reportStatistics>['vocabulary']}){
  return <div className="report-stat"><h3>{title}</h3><strong className="report-stat-number">{stats.average===null?'—':scoreText(stats.average)}</strong><b>điểm trung bình /10</b>{stats.best!==null&&<p>Cao nhất {scoreText(stats.best)}: <strong>{stats.leaders.join(', ')}</strong></p>}<small>Tính trên {stats.count} bạn có điểm</small></div>;
}
function LessonReport({lesson,editing,onEdit}:{lesson:LessonDetail;editing:boolean;onEdit:()=>void}){
  const stats=reportStatistics(lesson);const hasMini=stats.miniTest.count>0;
  const classes=[...new Set(lesson.records.map(r=>r.student.className).filter(Boolean))].join(', ');
  const rows=[...lesson.records].sort((a,b)=>reportName(a.student).localeCompare(reportName(b.student),'vi')||a.studentId.localeCompare(b.studentId));
  return <section className="lesson-report" aria-label={`Báo cáo ${lesson.title}`} data-guide="lesson-report">
    <div className="report-section-heading"><div><span className="report-kicker">{lesson.reportClassName||classes||'Chưa ghi tên lớp'} · {shortDate(lesson.heldOn)}</span><h2>{lesson.title}</h2></div><div className="report-heading-right"><strong>{lesson.vocabularyTotal===null?'Chưa đặt số từ':`${lesson.vocabularyTotal} từ vựng`}{hasMini?' · Mini test':''}</strong><Button className="report-controls" variant="outline" onClick={onEdit} disabled={editing||!rows.length}><SquarePen size={15}/>Nhập / sửa kết quả</Button></div></div>
    {!rows.length?<Notice>Không còn học sinh bạn phụ trách trong buổi này.</Notice>:<>
      <div className={`report-stats ${hasMini?'has-mini':''}`}>
        <div className="report-stat"><h3>Điểm danh</h3><strong className="report-stat-number">{stats.present}/{stats.total}</strong><b>bạn có mặt</b><p>{stats.late} đi muộn · {stats.excused} vắng có phép</p><small>{stats.absent} vắng · {stats.unmarked} chưa điểm danh</small></div>
        <div className="report-stat"><h3>Bài tập về nhà</h3><strong className="report-stat-number">{stats.complete}/{stats.total}</strong><b>bạn làm đầy đủ</b><p>{stats.partial} một phần · {stats.missing} cần bổ sung</p><small>{stats.unchecked} chưa kiểm tra</small></div>
        <ScoreSummary title="Từ vựng" stats={stats.vocabulary}/>{hasMini&&<ScoreSummary title="Mini test" stats={stats.miniTest}/>}
      </div>
      <div className="report-table-scroll"><table className="report-table"><caption className="sr-only">Kết quả {lesson.title}, {shortDate(lesson.heldOn)}</caption><thead><tr><th scope="col">STT</th><th scope="col">Học sinh</th><th scope="col">Điểm danh</th><th scope="col">Bài tập về nhà</th><th scope="col">Từ vựng<small>Số từ thuộc · điểm /10</small></th>{hasMini&&<th scope="col">Mini test<small>Điểm /10</small></th>}</tr></thead><tbody>{rows.map((r,index)=><tr key={r.studentId}><td>{index+1}</td><th scope="row"><strong>{reportName(r.student)}</strong><small>{r.student.className||'Chưa nhập lớp'} · {r.studentId.slice(0,8)}</small></th><td><AttendanceBadge status={r.status}/></td><td><HomeworkBadge status={r.homeworkStatus}/></td><td><div className="report-vocabulary">{r.vocabularyKnown!==null&&lesson.vocabularyTotal!==null?<><b>{r.vocabularyKnown}/{lesson.vocabularyTotal}</b><Score score={r.vocabularyKnown/lesson.vocabularyTotal*10}/></>:<span className="report-no-score">{r.status==='absent'||r.status==='excused'?'Vắng buổi này · chưa có điểm':'Chưa kiểm tra'}</span>}</div></td>{hasMini&&<td><Score score={r.miniTestScore}/></td>}</tr>)}</tbody></table></div>
      <p className="report-footnote">Điểm từ vựng = số từ thuộc / tổng số từ × 10. Trung bình tính từ điểm gốc, chỉ gồm các bạn có điểm. Đi muộn vẫn tính có mặt.</p>
      <p className="report-footnote">Bài tập và điểm kiểm tra do giáo viên ghi nhận; độc lập với tiến độ bài tập trên app.{lesson.records.some(r=>r.reportedAt)&&` Cập nhật ${new Date(Math.max(...lesson.records.map(r=>r.reportedAt?new Date(r.reportedAt).valueOf():0))).toLocaleString('vi-VN',{timeZone:'Asia/Bangkok'})}.`}</p>
    </>}
  </section>;
}

function ReportEditor({lesson,onCancel,onSaved}:{lesson:LessonDetail;onCancel:()=>void;onSaved:()=>void}){
  const {api}=useAuth();const [className,setClassName]=useState(lesson.reportClassName??[...new Set(lesson.records.map(r=>r.student.className).filter(Boolean))].join(', '));
  const [total,setTotal]=useState(lesson.vocabularyTotal===null?'':String(lesson.vocabularyTotal));
  const [records,setRecords]=useState(()=>lesson.records.map(r=>({studentId:r.studentId,homeworkStatus:r.homeworkStatus,vocabularyKnown:r.vocabularyKnown===null?'':String(r.vocabularyKnown),miniTestScore:r.miniTestScore===null?'':String(r.miniTestScore)})));
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[]);
  function update(index:number,patch:Partial<typeof records[number]>){setRecords(values=>values.map((r,i)=>i===index?{...r,...patch}:r));}
  async function save(event:FormEvent){event.preventDefault();if(busy)return;setBusy(true);setError('');const body:LessonReportInput={reportClassName:className.trim()||null,vocabularyTotal:total===''?null:Number(total),records:records.map(r=>({...r,vocabularyKnown:r.vocabularyKnown===''?null:Number(r.vocabularyKnown),miniTestScore:r.miniTestScore===''?null:Number(r.miniTestScore)}))};try{await api.saveLessonReport(lesson.id,body);toast.success('Đã lưu kết quả buổi học.');onSaved();}catch(e){setError(e instanceof Error?e.message:'Chưa lưu được báo cáo.');}finally{setBusy(false);}}
  return <Card className="panel report-editor report-controls"><h2>Nhập kết quả · {lesson.title}</h2><p className="small muted mb-4">Để trống nếu chưa kiểm tra; nhập 0 nếu đã kiểm tra và được 0 điểm. Điểm danh được sửa trong mục Điểm danh.</p>
    <form onSubmit={save}><fieldset disabled={busy} className="stack"><div className="two-col"><div className="field"><Label htmlFor="report-class">Tên lớp trên báo cáo</Label><Input id="report-class" maxLength={40} value={className} onChange={e=>setClassName(e.target.value)} placeholder="Ví dụ: Lớp 7A"/></div><div className="field"><Label htmlFor="vocabulary-total">Tổng số từ vựng</Label><Input id="vocabulary-total" type="number" min={1} max={500} step={1} value={total} onChange={e=>setTotal(e.target.value)} placeholder="Ví dụ: 15"/></div></div>
      <div className="report-table-scroll"><table className="report-table report-edit-table"><caption className="sr-only">Nhập kết quả cho từng học sinh</caption><thead><tr><th scope="col">Học sinh</th><th scope="col">Bài tập về nhà</th><th scope="col">Số từ thuộc</th><th scope="col">Mini test /10</th></tr></thead><tbody>{records.map((r,i)=>{const name=reportName(lesson.records[i].student);return <tr key={r.studentId}><th scope="row">{name}<small>{lesson.records[i].student.className} · {r.studentId.slice(0,8)}</small></th><td><select className="classroom-select" aria-label={`Bài tập về nhà ${name}`} value={r.homeworkStatus} onChange={e=>update(i,{homeworkStatus:e.target.value as HomeworkStatus})}>{Object.entries(homeworkLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></td><td><Input type="number" aria-label={`Số từ thuộc ${name}`} min={0} max={total?Number(total):500} step={1} value={r.vocabularyKnown} onChange={e=>update(i,{vocabularyKnown:e.target.value})} placeholder="Chưa kiểm tra"/></td><td><Input type="number" aria-label={`Mini test ${name}`} min={0} max={10} step="0.1" value={r.miniTestScore} onChange={e=>update(i,{miniTestScore:e.target.value})} placeholder="Chưa kiểm tra"/></td></tr>;})}</tbody></table></div>
      {error&&<Notice tone="error">{error}</Notice>}<div className="flex gap-3 justify-end"><Button type="button" variant="outline" onClick={onCancel}>Hủy thay đổi</Button><Button type="submit">{busy?'Đang lưu…':'Lưu kết quả'}</Button></div>
    </fieldset></form>
  </Card>;
}
