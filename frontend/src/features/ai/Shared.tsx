import {Badge} from '../../components/ui/badge';
import type {LearningSignals} from '../../types-ai';

export function AiSource({result}:{result:{provenance:string;createdAt:string;cached:boolean}}){
  return <div className="flex flex-wrap items-center gap-2 my-3 small muted"><Badge variant={result.provenance==='gemini'?'outline':'secondary'}>{result.provenance==='gemini'?'Gợi ý từ Gemini':'Nội dung mẫu mô phỏng'}</Badge><span>{result.cached?'Đã lưu · ':''}{new Date(result.createdAt).toLocaleString('vi-VN')}</span><span>Hãy kiểm tra nội dung trước khi áp dụng.</span></div>;
}
export function SignalSummary({statistics}:{statistics:LearningSignals}){
  return <p className="small muted my-3">Dữ liệu tại lúc tạo: {statistics.windowAttempts} lượt gần nhất{statistics.availableAttempts>statistics.windowAttempts?` trên ${statistics.availableAttempts} lượt đã lưu`:''} · {statistics.confirmed} đã chấm · {statistics.correct} đúng · {statistics.pending} chờ kiểm tra. Câu chờ kiểm tra không được tính sai.</p>;
}
