import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from './features/auth/context';
import { QuestionBank } from './features/teacher/QuestionBank';
import { BulkQuestionReview } from './features/teacher/BulkQuestionReview';
import { ApiClient } from './services/api';
import { templateQuestions } from './lib/question-files';
import type { BankQuestion, Role } from './types';

const ids=Array.from({length:135},(_,index)=>`question-${index}`);
const question={...templateQuestions[0],id:ids[0],createdBy:'teacher-test',status:'draft',reviewedBy:null,
  provenance:'teacher_import',model:'human',generatedAt:new Date().toISOString(),reviewFlags:'[]'} as BankQuestion;
function mount(element:React.ReactNode,role:Role='admin',demo=false) {
  const api=new ApiClient('test-access-code',demo);
  return render(<AuthContext.Provider value={{api,session:{role,actorId:'admin-test'},token:'test-access-code',login:vi.fn(),demo:vi.fn(),logout:vi.fn()}}>
    <MemoryRouter>{element}</MemoryRouter>
  </AuthContext.Provider>);
}

describe('bulk question review controls',()=>{
  it('approves the server preview across all pages only after a note and attestation',async()=>{
    const questions=vi.spyOn(ApiClient.prototype,'questions').mockResolvedValue({questions:[question]});
    const preview=vi.spyOn(ApiClient.prototype,'previewBulkReview').mockResolvedValue({ids,matched:135,skippedOwn:0});
    const review=vi.spyOn(ApiClient.prototype,'bulkReview').mockResolvedValue({reviewed:135,status:'approved'});
    mount(<QuestionBank/>);
    const user=userEvent.setup();
    await waitFor(()=>expect(screen.getByRole('button',{name:'Duyệt tất cả'})).toBeEnabled());
    await user.click(screen.getByRole('button',{name:'Duyệt tất cả'}));
    const dialog=await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('status')).toHaveTextContent('135 câu hỏi');
    expect(preview).toHaveBeenCalledWith('approve',{});
    const submit=within(dialog).getByRole('button',{name:'Duyệt 135 câu hỏi'});
    expect(submit).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Ghi chú cho tất cả câu hỏi (ít nhất 5 ký tự)'),'Đã kiểm tra toàn bộ ngữ pháp và đáp án.');
    expect(submit).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(submit);
    await waitFor(()=>expect(review).toHaveBeenCalledWith(ids,'approve','Đã kiểm tra toàn bộ ngữ pháp và đáp án.',true));
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(questions.mock.calls.length).toBeGreaterThan(1);
  });

  it('declines matching drafts with a note and does not require approval attestation',async()=>{
    const preview=vi.spyOn(ApiClient.prototype,'previewBulkReview').mockResolvedValue({ids,matched:135,skippedOwn:0});
    const review=vi.spyOn(ApiClient.prototype,'bulkReview').mockResolvedValue({reviewed:135,status:'rejected'});
    const onClose=vi.fn(),onReviewed=vi.fn();
    mount(<BulkQuestionReview action="reject" filters={{tense:'past_simple',search:'school'}} onClose={onClose} onReviewed={onReviewed}/>);
    const user=userEvent.setup();
    const submit=await screen.findByRole('button',{name:'Từ chối 135 câu hỏi'});
    expect(preview).toHaveBeenCalledWith('reject',{tense:'past_simple',search:'school'});
    expect(submit).toBeDisabled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Ghi chú cho tất cả câu hỏi (ít nhất 5 ký tự)'),'Cần chỉnh lại nội dung trước khi xuất bản.');
    await user.click(submit);
    expect(review).toHaveBeenCalledWith(ids,'reject','Cần chỉnh lại nội dung trước khi xuất bản.',false);
    expect(onClose).toHaveBeenCalledOnce();expect(onReviewed).toHaveBeenCalledOnce();
  });

  it.each(['teacher','student'] as const)('does not expose bulk controls to a %s',async role=>{
    vi.spyOn(ApiClient.prototype,'questions').mockResolvedValue({questions:[question]});
    mount(<QuestionBank/>,role);
    await screen.findByText(question.content);
    expect(screen.queryByRole('button',{name:'Duyệt tất cả'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Từ chối tất cả'})).not.toBeInTheDocument();
  });

  it('reports skipped self-authored questions and disables empty selections',async()=>{
    vi.spyOn(ApiClient.prototype,'previewBulkReview').mockResolvedValue({ids:[],matched:2,skippedOwn:2});
    const review=vi.spyOn(ApiClient.prototype,'bulkReview');
    mount(<BulkQuestionReview action="approve" filters={{}} onClose={vi.fn()} onReviewed={vi.fn()}/>);
    expect(await screen.findByText(/2 câu do bạn tạo được bỏ qua/)).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Duyệt 0 câu hỏi'})).toBeDisabled();
    expect(review).not.toHaveBeenCalled();
  });

  it('keeps the note and dialog when saving fails',async()=>{
    vi.spyOn(ApiClient.prototype,'previewBulkReview').mockResolvedValue({ids:[ids[0]!],matched:1,skippedOwn:0});
    vi.spyOn(ApiClient.prototype,'bulkReview').mockRejectedValue(new Error('Danh sách đã thay đổi. Chưa xử lý câu nào.'));
    const onClose=vi.fn(),onReviewed=vi.fn();
    mount(<BulkQuestionReview action="reject" filters={{}} onClose={onClose} onReviewed={onReviewed}/>);
    const user=userEvent.setup();
    const submit=await screen.findByRole('button',{name:'Từ chối 1 câu hỏi'});
    const note=screen.getByLabelText('Ghi chú cho tất cả câu hỏi (ít nhất 5 ký tự)');
    await user.type(note,'Kiểm tra lại nội dung.');await user.click(submit);
    expect(await screen.findByText('Danh sách đã thay đổi. Chưa xử lý câu nào.')).toBeInTheDocument();
    expect(note).toHaveValue('Kiểm tra lại nội dung.');
    expect(onClose).not.toHaveBeenCalled();expect(onReviewed).not.toHaveBeenCalled();
  });
});
