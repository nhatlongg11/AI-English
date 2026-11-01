import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext } from './features/auth/context';
import { ManualQuestion, ImportQuestions } from './features/teacher/QuestionAuthoring';
import { QuestionBank } from './features/teacher/QuestionBank';
import { MemoryRouter } from 'react-router-dom';
import { ApiClient } from './services/api';
import { parseQuestionFile, readCsv, templateCsv, templateQuestions } from './lib/question-files';
import type { BankQuestion, ImportPreview } from './types';

const preview=(invalid=false):ImportPreview=>({rows:[{row:1,content:templateQuestions[0].content,valid:!invalid,duplicate:null,errors:invalid?['Đáp án đúng cần khớp một lựa chọn.']:[]}],invalidCount:invalid?1:0,duplicateCount:0,readyCount:invalid?0:1});
const saved={...templateQuestions[0],id:'saved-question',status:'draft',reviewedBy:null,reviewFlags:'[]',provenance:'teacher_manual',model:'human',generatedAt:new Date().toISOString()} as BankQuestion;
function mount(element:React.ReactNode) {
  const api=new ApiClient('test-teacher-token');
  return render(<AuthContext.Provider value={{api,session:{role:'teacher',actorId:'teacher-test'},token:'test-teacher-token',login:vi.fn(),demo:vi.fn(),logout:vi.fn()}}>{element}</AuthContext.Provider>);
}
describe('spreadsheet and JSON question files',()=>{
  it('round trips the Vietnamese Excel template across all three formats',()=>{
    const questions=parseQuestionFile('questions.csv',templateCsv()) as typeof templateQuestions;
    expect(questions.map(q=>q.questionType)).toEqual(['multiple_choice','fill_in_blank','error_correction']);
    expect(questions.map(q=>q.correctAnswer)).toEqual(templateQuestions.map(q=>q.correctAnswer));
    expect(questions[0].options).toHaveLength(3);expect(questions[1].options).toEqual([]);
    expect(parseQuestionFile('questions.json',JSON.stringify({questions:templateQuestions}))).toEqual(templateQuestions);
  });
  it('handles quoted commas, escaped quotes, newlines, BOM and semicolon separators',()=>{
    expect(readCsv('\uFEFFone;two\r\n"say ""hello""; again";"line 1\nline 2"\r\n')).toEqual([['one','two'],['say "hello"; again','line 1\nline 2']]);
    expect(readCsv('a,b\n"quoted, comma",yes')).toEqual([['a','b'],['quoted, comma','yes']]);
  });
  it('rejects malformed, unsupported, empty, duplicated headers and oversized batches',()=>{
    expect(()=>readCsv('a,b\n"unfinished,cell')).toThrow('ngoặc kép');
    expect(()=>parseQuestionFile('q.xlsx','')).toThrow('CSV UTF-8');
    expect(()=>parseQuestionFile('q.json','{')).toThrow('JSON');
    expect(()=>parseQuestionFile('q.csv','')).toThrow('trống');
    expect(()=>parseQuestionFile('q.csv','Chủ đề,tense\npresent_simple,present_simple')).toThrow('cùng nghĩa');
    expect(()=>parseQuestionFile('q.csv','constructor,Câu hỏi\nanything,example')).toThrow('cột chưa được hỗ trợ');
    expect(()=>parseQuestionFile('q.json',JSON.stringify(Array(51).fill(templateQuestions[0])))).toThrow('50 câu');
    expect(()=>parseQuestionFile('q.csv','Chủ đề,Câu hỏi\npresent_simple,one,extra')).toThrow('số ô');
  });
});
describe('teacher authoring controls',()=>{
  it('opens the editor from the bank and takes a saved question into the existing review flow',async()=>{
    vi.spyOn(ApiClient.prototype,'questions').mockResolvedValue({questions:[]});
    vi.spyOn(ApiClient.prototype,'previewImport').mockResolvedValue(preview());
    vi.spyOn(ApiClient.prototype,'createQuestion').mockResolvedValue({question:saved});
    mount(<MemoryRouter><QuestionBank/></MemoryRouter>);
    const user=userEvent.setup();
    expect(screen.getByRole('button',{name:'Nhập từ tệp'})).toBeEnabled();
    await user.click(screen.getByRole('button',{name:'Tự soạn câu hỏi'}));
    expect(screen.getByRole('dialog')).toHaveTextContent('Tự soạn câu hỏi');
    fireEvent.change(screen.getByLabelText('Đề bài bằng tiếng Anh'),{target:{value:templateQuestions[0].content}});
    for(const [i,value] of ['plays','play','playing','played'].entries())fireEvent.change(screen.getByRole('textbox',{name:`Đáp án ${String.fromCharCode(65+i)}`}),{target:{value}});
    fireEvent.change(screen.getByLabelText('Giải thích bằng tiếng Việt'),{target:{value:templateQuestions[0].explanationVi}});
    fireEvent.change(screen.getByLabelText('Quy tắc cần ghi nhớ'),{target:{value:templateQuestions[0].grammarRule}});
    await user.click(screen.getByRole('button',{name:'Lưu bản nháp'}));
    await waitFor(()=>expect(screen.getByRole('dialog')).toHaveTextContent(templateQuestions[0].content));
    expect(within(screen.getByRole('dialog')).getByText('Tự soạn')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('Chờ quản trị viên duyệt');
  });
  it('saves the selected multiple-choice answer as a draft through the real-account adapter',async()=>{
    const validate=vi.spyOn(ApiClient.prototype,'previewImport').mockResolvedValue(preview());
    const create=vi.spyOn(ApiClient.prototype,'createQuestion').mockResolvedValue({question:saved});const onSaved=vi.fn();
    mount(<ManualQuestion onClose={vi.fn()} onSaved={onSaved}/>);
    const user=userEvent.setup();
    await user.click(screen.getByLabelText('Đề bài bằng tiếng Anh'));await user.paste('Every Friday, our cousin ____ chess.');
    for(const [i,option] of ['play','plays','playing','played'].entries())await user.type(screen.getByRole('textbox',{name:`Đáp án ${String.fromCharCode(65+i)}`}),option);
    await user.click(screen.getByRole('radio',{name:'Chọn B làm đáp án đúng'}));
    await user.click(screen.getByLabelText('Giải thích bằng tiếng Việt'));await user.paste('Chủ ngữ số ít nên dùng plays trong thì hiện tại đơn.');
    await user.click(screen.getByLabelText('Quy tắc cần ghi nhớ'));await user.paste('Thêm s hoặc es cho động từ với chủ ngữ số ít.');
    await user.click(screen.getByRole('button',{name:'Lưu bản nháp'}));
    await waitFor(()=>expect(onSaved).toHaveBeenCalledWith([saved]));
    expect(validate).toHaveBeenCalledTimes(1);expect(create).toHaveBeenCalledWith(expect.objectContaining({correctAnswer:'plays',questionType:'multiple_choice',options:expect.arrayContaining([{text:'plays',errorCode:null}])}));
  });
  it('previews an upload before saving and preserves the duplicate-skip choice',async()=>{
    vi.spyOn(ApiClient.prototype,'previewImport').mockResolvedValue(preview());
    const save=vi.spyOn(ApiClient.prototype,'importQuestions').mockResolvedValue({questions:[saved],skipped:0});const onSaved=vi.fn();
    mount(<ImportQuestions onClose={vi.fn()} onSaved={onSaved}/>);
    expect(screen.getByRole('button',{name:'Nhập 0 câu vào kho'})).toBeDisabled();
    const user=userEvent.setup();await user.upload(screen.getByLabelText('Chọn tệp CSV hoặc JSON'),new File([JSON.stringify([templateQuestions[0]])],'q.json',{type:'application/json'}));
    const submit=await screen.findByRole('button',{name:'Nhập 1 câu vào kho'});
    expect(save).not.toHaveBeenCalled();await user.click(submit);
    await waitFor(()=>expect(onSaved).toHaveBeenCalledWith([saved]));
    expect(save).toHaveBeenCalledWith([templateQuestions[0]],true);
  });
  it('shows row errors and blocks saving an invalid import',async()=>{
    vi.spyOn(ApiClient.prototype,'previewImport').mockResolvedValue(preview(true));const save=vi.spyOn(ApiClient.prototype,'importQuestions');
    mount(<ImportQuestions onClose={vi.fn()} onSaved={vi.fn()}/>);
    const user=userEvent.setup();await user.upload(screen.getByLabelText('Chọn tệp CSV hoặc JSON'),new File([JSON.stringify([templateQuestions[0]])],'q.json',{type:'application/json'}));
    expect(await screen.findByText('Đáp án đúng cần khớp một lựa chọn.')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Nhập 0 câu vào kho'})).toBeDisabled();expect(save).not.toHaveBeenCalled();
  });
});
