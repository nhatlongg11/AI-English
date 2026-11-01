import {useState} from 'react';
import {Sparkles} from 'lucide-react';
import {useAuth} from '../auth/context';
import {Button} from '../../components/ui/button';
import {Notice} from '../../components/common';
import {AiSource} from './Shared';
import type {ExplanationResult} from '../../types-ai';

export function AnswerHelp({attemptId}:{attemptId:string}){
  const {api}=useAuth();const [result,setResult]=useState<ExplanationResult|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function explain(){if(busy||result)return;setBusy(true);setError('');try{setResult(await api.explainAnswer(attemptId));}catch(e){setError(e instanceof Error?e.message:'Chưa tải được giải thích.');}finally{setBusy(false);}}
  return <div className="ai-help mt-4"><Button variant="outline" disabled={busy||api.demo||!!result} onClick={explain}><Sparkles size={16}/>{busy?'AI đang giải thích…':result?'Đã mở giải thích AI':'Nhờ AI giải thích dễ hiểu hơn'}</Button><p className="small muted mt-2">Chỉ dùng sau khi nộp. Giải thích AI không đổi điểm hoặc kết quả đã chấm.</p>
    {error&&<Notice tone="error">{error}</Notice>}{result&&<div className="detail-box mt-3"><AiSource result={result}/><h3>{result.data.ruleVi}</h3><ol className="list-decimal pl-5 my-3 space-y-2">{result.data.stepsVi.map((step,i)=><li key={i}>{step}</li>)}</ol><p lang="en" className="font-medium">{result.data.example.sentence}</p><p>{result.data.example.meaningVi}</p><p className="small muted mt-3">{result.data.encouragementVi}</p></div>}
  </div>;
}
