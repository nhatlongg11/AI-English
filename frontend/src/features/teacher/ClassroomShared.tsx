import {useState} from 'react';
import {useAuth} from '../auth/context';
import {useResource} from '../../hooks/use-resource';
import {EmptyState,Loading,ResourceError} from '../../components/common';
import {Button} from '../../components/ui/button';
import {Input} from '../../components/ui/input';
import {StudentProfile} from './StudentProfile';
import {studentLabel} from '../../lib/student-identity';
export {studentLabel} from '../../lib/student-identity';

const searchKey=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').replace(/[_\s]+/g,' ').toLocaleLowerCase();
export function toggleId(ids:string[],id:string){return ids.includes(id)?ids.filter(value=>value!==id):[...ids,id];}
export function Pager({page,setPage,hasNext,loading}:{page:number;setPage:(page:number)=>void;hasNext:boolean;loading?:boolean}){
  return <div className="flex gap-3 items-center mt-4"><Button type="button" variant="outline" size="sm" disabled={page===0||loading} onClick={()=>setPage(page-1)}>Trang trước</Button><span className="small muted">Trang {page+1}</span><Button type="button" variant="outline" size="sm" disabled={!hasNext||loading} onClick={()=>setPage(page+1)}>Trang sau</Button></div>;
}
export function RosterPicker({selected,onChange}:{selected:string[];onChange:(ids:string[])=>void}){
  const {api,session}=useAuth();const [page,setPage]=useState(0);const [search,setSearch]=useState('');
  const roster=useResource(`classroom-roster:${session?.actorId}:${page}`,()=>api.students(page*100));
  const students=roster.data?.students.filter(s=>searchKey(`${studentLabel(s)} ${s.displayName??''} ${s.className??''} ${s.id}`).includes(searchKey(search)))??[];
  return <fieldset className="stack"><legend className="font-semibold">Chọn học sinh · {selected.length}/100</legend><Input aria-label="Tìm học sinh trong trang" placeholder="Tìm tên hoặc mã học sinh trong trang này…" value={search} onChange={e=>setSearch(e.target.value)}/>
    {roster.loading?<Loading/>:roster.error?<ResourceError message={roster.error} retry={roster.reload}/>:!students.length?<EmptyState title="Chưa có học sinh phù hợp" description="Tạo mã trong mục Học sinh hoặc đổi tìm kiếm."/>:<div className="selection-list">{students.map(s=><div className="selection-row flex-wrap" key={s.id}><label className="flex gap-3 flex-1 min-w-0 cursor-pointer"><input type="checkbox" checked={selected.includes(s.id)} disabled={!selected.includes(s.id)&&selected.length>=100} onChange={()=>onChange(toggleId(selected,s.id))}/><span className="min-w-0 break-words">{studentLabel(s)}<small className="block muted">{s.displayName||'Chưa nhập họ tên'} · {s.className||'Chưa nhập lớp'}</small></span></label><StudentProfile student={s} onSaved={roster.reload}/></div>)}</div>}
    <Pager page={page} setPage={setPage} loading={roster.loading} hasNext={roster.data?.nextOffset!=null}/>
  </fieldset>;
}
