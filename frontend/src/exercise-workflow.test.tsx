import {describe,it,expect,vi} from 'vitest';
import {render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {AuthContext} from './features/auth/context';
import {ExerciseComposer} from './features/teacher/ExerciseComposer';
import {ExerciseRecipients,assignmentRoster} from './features/teacher/ExercisePickers';
import {ApiClient} from './services/api';
import {demoBank} from './services/demo';
import type {BankQuestion,ExerciseDetail} from './types';

const students=[
  {id:'student-1',displayName:'Minh Anh',className:'8A1',teacherId:'teacher-test',mode:'adaptive',experimentGroup:'general',createdAt:'2026-10-28',total:0,confirmed:0,correct:0},
  {id:'student-2',displayName:'Ngọc Hà',className:'8A1',teacherId:'teacher-test',mode:'adaptive',experimentGroup:'general',createdAt:'2026-10-28',total:0,confirmed:0,correct:0},
  {id:'student-3',displayName:'Lan Chi',className:'8A2',teacherId:'teacher-test',mode:'adaptive',experimentGroup:'general',createdAt:'2026-10-28',total:0,confirmed:0,correct:0},
];
const questions=[0,1].map(index=>({...demoBank[0],id:`question-${index}`,content:`Every morning, pupil ${index} ____ to school.`,status:'approved' as const}));
const saved={id:'exercise-saved',title:'Bài ôn tập',instructions:'',publishedAt:null,questionCount:1,studentCount:1,questions:[],recipients:[]} as ExerciseDetail;
function mount(element:React.ReactNode) {
  const api=new ApiClient('local-test-teacher');
  return render(<MemoryRouter><AuthContext.Provider value={{api,session:{role:'teacher',actorId:'teacher-test'},token:'local-test-teacher',login:vi.fn(),demo:vi.fn(),logout:vi.fn()}}>{element}</AuthContext.Provider></MemoryRouter>);
}
function setup(bank:BankQuestion[]=questions,roster=students) {
  vi.spyOn(ApiClient.prototype,'students').mockResolvedValue({students:roster,nextOffset:null});
  vi.spyOn(ApiClient.prototype,'questions').mockImplementation(async query=>{
    const offset=Number(new URLSearchParams(query).get('offset')??0);
    return {questions:bank.slice(offset,offset+100)};
  });
  const save=vi.spyOn(ApiClient.prototype,'saveExercise').mockResolvedValue({exercise:saved});
  const publish=vi.spyOn(ApiClient.prototype,'publishExercise').mockResolvedValue({exercise:saved});
  const onSaved=vi.fn();
  mount(<ExerciseComposer onSaved={onSaved} onCancel={vi.fn()}/>);
  return {user:userEvent.setup(),save,publish,onSaved};
}
async function selectStudent(user:ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('checkbox',{name:/Minh Anh/}));
  await user.click(screen.getByRole('button',{name:'Tiếp tục: Chọn câu hỏi'}));
}
async function selectQuestions(user:ReturnType<typeof userEvent.setup>,count=1) {
  for(let index=0;index<count;index++)await user.click(await screen.findByRole('checkbox',{name:new RegExp(`pupil ${index} `)}));
  await user.click(screen.getByRole('button',{name:'Tiếp tục: Đặt tên bài'}));
  await user.type(screen.getByLabelText(/Tên bài tập/),'Bài ôn tập');
  await user.click(screen.getByRole('button',{name:'Tiếp tục: Kiểm tra & giao'}));
}

describe('guided assignment preparation',()=>{
  it('starts with recipients, explains disabled next steps and keeps selections across classes',async()=>{
    const {user,save,publish}=setup();
    expect(screen.getByRole('button',{name:'Tiếp tục: Chọn câu hỏi'})).toBeDisabled();
    expect(screen.queryByLabelText(/Tên bài tập/)).not.toBeInTheDocument();
    expect(screen.getByText('Chọn ít nhất 1 học sinh để tiếp tục.')).toBeInTheDocument();
    await screen.findByRole('checkbox',{name:/Minh Anh/});
    await user.selectOptions(screen.getByLabelText('Lớp nhận bài'),'8A1');
    await user.click(screen.getByRole('button',{name:'Chọn cả lớp (2)'}));
    await user.selectOptions(screen.getByLabelText('Lớp nhận bài'),'8A2');
    await user.click(screen.getByRole('checkbox',{name:/Lan Chi/}));
    await user.click(screen.getByRole('button',{name:'Tiếp tục: Chọn câu hỏi'}));
    expect(screen.getByText('3 học sinh · 0 câu hỏi')).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Quay lại'}));
    await user.selectOptions(screen.getByLabelText('Lớp nhận bài'),'all');
    expect(screen.getByRole('checkbox',{name:/Minh Anh/})).toBeChecked();
    expect(screen.getByRole('checkbox',{name:/Ngọc Hà/})).toBeChecked();
    expect(screen.getByRole('checkbox',{name:/Lan Chi/})).toBeChecked();
    expect(save).not.toHaveBeenCalled();expect(publish).not.toHaveBeenCalled();
  });

  it('searches the full question bank including items after the first API page',async()=>{
    const bank=Array.from({length:135},(_,index)=>({...questions[0]!,id:`question-${index}`,content:index===134?'The special library question after page one.':`Practice question number ${index}.`}));
    const {user}=setup(bank);
    await selectStudent(user);
    await user.type(screen.getByRole('textbox',{name:'Tìm câu hỏi cho bài tập'}),'special library');
    const result=await screen.findByRole('checkbox',{name:/special library question/});
    await user.click(result);
    expect(within(screen.getByRole('complementary',{name:'Thứ tự câu hỏi đã chọn'})).getByText('The special library question after page one.')).toBeInTheDocument();
    expect(ApiClient.prototype.questions).toHaveBeenCalledWith('offset=100');
  });

  it('preserves question ordering, names and instructions when moving back through steps',async()=>{
    const {user,save,publish,onSaved}=setup();
    await selectStudent(user);
    for(let index=0;index<2;index++)await user.click(await screen.findByRole('checkbox',{name:new RegExp(`pupil ${index} `)}));
    await user.click(screen.getByRole('button',{name:'Đưa câu 2 lên'}));
    await user.click(screen.getByRole('button',{name:'Tiếp tục: Đặt tên bài'}));
    await user.type(screen.getByLabelText(/Tên bài tập/),'Bài ôn tập');
    await user.type(screen.getByLabelText(/Lời dặn học sinh/),'Đọc kỹ câu hỏi.');
    await user.click(screen.getByRole('button',{name:'Tiếp tục: Kiểm tra & giao'}));
    expect(save).not.toHaveBeenCalled();expect(publish).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button',{name:'Quay lại'}));
    expect(screen.getByLabelText(/Tên bài tập/)).toHaveValue('Bài ôn tập');
    expect(screen.getByLabelText(/Lời dặn học sinh/)).toHaveValue('Đọc kỹ câu hỏi.');
    await user.click(screen.getByRole('button',{name:'Tiếp tục: Kiểm tra & giao'}));
    await user.click(screen.getByRole('button',{name:'Giao bài ngay'}));
    await waitFor(()=>expect(onSaved).toHaveBeenCalledWith('exercise-saved',true));
    expect(save).toHaveBeenCalledWith({title:'Bài ôn tập',instructions:'Đọc kỹ câu hỏi.',studentIds:['student-1'],questionIds:['question-1','question-0']},undefined);
    expect(publish).toHaveBeenCalledOnce();
  });

  it('offers draft saving while clearly blocking publication of pending questions',async()=>{
    const {user,save,publish,onSaved}=setup([{...questions[0]!,status:'draft'}]);
    await selectStudent(user);
    expect(screen.queryByRole('checkbox',{name:/pupil 0 /})).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox',{name:'Hiện cả câu chờ duyệt để chuẩn bị bản nháp'}));
    await selectQuestions(user);
    expect(screen.getByRole('button',{name:'Giao bài ngay'})).toBeDisabled();
    expect(screen.getByText(/1 câu hỏi đang chờ duyệt/)).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Lưu bản nháp'}));
    await waitFor(()=>expect(onSaved).toHaveBeenCalledWith('exercise-saved',false));
    expect(save).toHaveBeenCalledOnce();expect(publish).not.toHaveBeenCalled();
  });

  it('retries publication of the saved draft without creating a duplicate assignment',async()=>{
    const {user,save,publish,onSaved}=setup();
    publish.mockRejectedValueOnce(new Error('Mất kết nối tạm thời.'));
    await selectStudent(user);await selectQuestions(user);
    await user.click(screen.getByRole('button',{name:'Giao bài ngay'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bản nháp đã được lưu.');
    expect(onSaved).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button',{name:'Giao bài ngay'}));
    await waitFor(()=>expect(onSaved).toHaveBeenCalledWith('exercise-saved',true));
    expect(save).toHaveBeenCalledOnce();expect(publish).toHaveBeenCalledTimes(2);
  });

  it('refreshes newly approved questions without losing the assignment being prepared',async()=>{
    const {user,save,publish}=setup([{...questions[0]!,status:'draft'}]);
    await selectStudent(user);
    await user.click(screen.getByRole('checkbox',{name:'Hiện cả câu chờ duyệt để chuẩn bị bản nháp'}));
    await selectQuestions(user);
    expect(screen.getByRole('button',{name:'Giao bài ngay'})).toBeDisabled();
    vi.mocked(ApiClient.prototype.questions).mockResolvedValue({questions:[questions[0]!]});
    await user.click(screen.getByRole('button',{name:'Cập nhật trạng thái câu hỏi'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Giao bài ngay'})).toBeEnabled());
    expect(screen.getByRole('heading',{name:'Bài ôn tập'})).toBeInTheDocument();
    expect(screen.getByText('1 học sinh · 1 câu hỏi')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();expect(publish).not.toHaveBeenCalled();
  });

  it('shows a useful first step when no students are assigned to the teacher',async()=>{
    setup(questions,[]);
    expect(await screen.findByRole('link',{name:'Mở mục Học sinh'})).toHaveAttribute('href','/teacher/students');
    expect(screen.getByRole('button',{name:'Tiếp tục: Chọn câu hỏi'})).toBeDisabled();
  });

  it('loads all roster pages and normalizes older records with missing names',async()=>{
    const api=new ApiClient('test');
    vi.spyOn(api,'students').mockResolvedValueOnce({students:[students[0]!],nextOffset:100}).mockResolvedValueOnce({students:[{...students[1]!,displayName:undefined}],nextOffset:null});
    const loaded=await assignmentRoster(api);
    expect(loaded).toHaveLength(2);expect(loaded[1]!.displayName).toBeNull();expect(api.students).toHaveBeenCalledWith(100);
  });

  it('does not silently select a partial class larger than the assignment limit',()=>{
    const large=Array.from({length:101},(_,index)=>({...students[0]!,id:`student-${index}`}));
    const onChange=vi.fn();
    mount(<ExerciseRecipients resource={{data:large,loading:false,reload:vi.fn()}} selected={[]} onChange={onChange}/>);
    expect(screen.getByRole('button',{name:'Chọn tất cả kết quả (101)'})).toBeDisabled();
    expect(screen.getByText(/vượt quá 100 học sinh/)).toBeInTheDocument();expect(onChange).not.toHaveBeenCalled();
  });
});
