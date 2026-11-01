import { useState } from 'react';
import { ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/context';
import { useResource } from '../../hooks/use-resource';
import { Loading, Notice, ResourceError } from '../../components/common';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import type { BulkReviewFilters, ReviewAction } from '../../types';

export function BulkQuestionReview({action,filters,onClose,onReviewed}:{
  action:ReviewAction;filters:BulkReviewFilters;onClose:()=>void;onReviewed:()=>void;
}) {
  const {api}=useAuth();
  const preview=useResource(`bulk-review:${action}:${JSON.stringify(filters)}`,()=>api.previewBulkReview(action,filters));
  const [note,setNote]=useState('');
  const [checked,setChecked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const approving=action==='approve';
  const count=preview.data?.ids.length??0;

  async function submit() {
    if(busy||preview.loading||preview.error||!count||note.trim().length<5||(approving&&!checked))return;
    setBusy(true);setError('');
    try {
      const result=await api.bulkReview(preview.data!.ids,action,note.trim(),checked);
      toast.success(approving?`Đã duyệt ${result.reviewed} câu hỏi.`:`Đã từ chối ${result.reviewed} câu hỏi.`);
      onReviewed();onClose();
    } catch(e) {
      setError(e instanceof Error?e.message:'Không thể lưu kết quả kiểm duyệt.');
    } finally {setBusy(false);}
  }

  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}>
    <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{approving?'Duyệt tất cả câu chờ duyệt':'Từ chối tất cả câu chờ duyệt'}</DialogTitle>
        <DialogDescription>Áp dụng cho các câu chờ duyệt khớp bộ lọc hiện tại, trên tất cả các trang.</DialogDescription>
      </DialogHeader>
      {preview.loading?<Loading/>:preview.error?<ResourceError message={preview.error} retry={preview.reload}/>:<div className="stack">
        <p role="status"><strong>{count} câu hỏi</strong> sẽ được {approving?'duyệt và xuất bản':'từ chối'}.</p>
        {Boolean(preview.data?.skippedOwn)&&<Notice>{preview.data!.skippedOwn} câu do bạn tạo được bỏ qua. Cần một quản trị viên khác duyệt các câu này.</Notice>}
        {count===0?<Notice>Không có câu hỏi phù hợp để xử lý.</Notice>:<>
          <div className="field">
            <Label htmlFor="bulk-review-note">Ghi chú cho tất cả câu hỏi (ít nhất 5 ký tự)</Label>
            <Textarea id="bulk-review-note" value={note} onChange={e=>setNote(e.target.value)} maxLength={500} disabled={busy}/>
          </div>
          {approving&&<div className="flex items-start gap-3">
            <Checkbox id="bulk-review-checked" checked={checked} onCheckedChange={value=>setChecked(value===true)} disabled={busy}/>
            <Label htmlFor="bulk-review-checked" className="text-sm leading-6">Tôi đã kiểm tra ngữ pháp, đáp án duy nhất, độ khó và các lựa chọn của tất cả câu hỏi được duyệt.</Label>
          </div>}
          {error&&<Notice tone="error">{error}</Notice>}
        </>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={busy}>Hủy</Button>
          <Button variant={approving?'default':'destructive'} onClick={submit} disabled={busy||count===0||note.trim().length<5||(approving&&!checked)}>
            {approving?<ShieldCheck size={16}/>:<XCircle size={16}/>}
            {busy?'Đang lưu…':`${approving?'Duyệt':'Từ chối'} ${count} câu hỏi`}
          </Button>
        </div>
      </div>}
    </DialogContent>
  </Dialog>;
}
