import {useId,useState,type FormEvent} from 'react';
import {useAuth} from '../auth/context';
import {Notice} from '../../components/common';
import {Button} from '../../components/ui/button';
import {Input} from '../../components/ui/input';
import {Label} from '../../components/ui/label';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '../../components/ui/dialog';
import {studentLabel,type StudentIdentity} from '../../lib/student-identity';

export function StudentProfile({student,onSaved}:{student:StudentIdentity;onSaved:()=>void}){
  const {api}=useAuth();const field=useId();const [open,setOpen]=useState(false);const [name,setName]=useState('');const [className,setClassName]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  function start(){setName(student.displayName??'');setClassName(student.className??'');setError('');setOpen(true);}
  async function save(e:FormEvent){e.preventDefault();e.stopPropagation();if(busy)return;setBusy(true);setError('');try{await api.studentName(student.id,name.trim(),className.trim());setOpen(false);onSaved();}catch(e){setError(e instanceof Error?e.message:'Chưa lưu được thông tin.');}finally{setBusy(false);}}
  return <><Button type="button" variant="link" size="sm" className="px-0" disabled={api.demo} onClick={start} aria-label={`Sửa họ tên và lớp ${studentLabel(student)}`}>Sửa họ tên và lớp</Button>
    <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent><DialogHeader><DialogTitle>Họ tên và lớp học sinh</DialogTitle><DialogDescription>Thông tin này giúp thầy cô nhận ra học sinh khi điểm danh và giao bài. Mã đăng nhập và tiến độ được giữ nguyên.</DialogDescription></DialogHeader>
      <form className="stack" onSubmit={save}><div className="field"><Label htmlFor={field+'-name'}>Họ và tên</Label><Input id={field+'-name'} required maxLength={80} value={name} disabled={busy} onChange={e=>setName(e.target.value)} placeholder="Nguyễn Văn An"/></div>
        <div className="field"><Label htmlFor={field+'-class'}>Lớp</Label><Input id={field+'-class'} required maxLength={40} value={className} disabled={busy} onChange={e=>setClassName(e.target.value)} placeholder="8A1"/></div>
        <p className="small muted break-words">Hiển thị: {studentLabel({...student,displayName:name,className})}</p>{error&&<Notice tone="error">{error}</Notice>}<Button disabled={busy||!name.trim()||!className.trim()}>{busy?'Đang lưu…':'Lưu thông tin'}</Button>
      </form></DialogContent></Dialog></>;
}
