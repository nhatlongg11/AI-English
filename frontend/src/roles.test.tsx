import {describe,it,expect,vi} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {AuthContext} from './features/auth/context';
import {Students} from './features/teacher/Students';
import {QuestionReview} from './features/teacher/QuestionReview';
import {ResearchDashboard} from './features/research/Research';
import {ApiClient} from './services/api';
import {demoBank,demoResearch} from './services/demo';
import type {Role} from './types';

function mount(element:React.ReactNode,role:Role='teacher') {
  const api=new ApiClient('role-test-token');
  return render(<AuthContext.Provider value={{api,session:{role,actorId:'current-user'},token:'role-test-token',login:vi.fn(),demo:vi.fn(),logout:vi.fn()}}>{element}</AuthContext.Provider>);
}
describe('role-specific staff interfaces',()=>{
  it('shows teachers draft content without publication controls',()=>{
    const review=vi.spyOn(ApiClient.prototype,'review');
    mount(<QuestionReview question={{...demoBank[0],status:'draft'}} onClose={vi.fn()} onReviewed={vi.fn()}/>);
    expect(screen.getByRole('dialog')).toHaveTextContent('Chờ quản trị viên duyệt');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Duyệt & xuất bản'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Từ chối'})).not.toBeInTheDocument();
    expect(review).not.toHaveBeenCalled();
  });
  it('keeps approval disabled for the administrator who created the question',async()=>{
    mount(<QuestionReview question={{...demoBank[0],status:'draft',createdBy:'current-user'}} onClose={vi.fn()} onReviewed={vi.fn()}/>,'admin');
    const user=userEvent.setup();
    await user.type(screen.getByLabelText('Ghi chú kiểm duyệt (ít nhất 5 ký tự)'),'Đã kiểm tra câu hỏi.');
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button',{name:'Duyệt & xuất bản'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'Từ chối'})).toBeEnabled();
    expect(screen.getByText('Cần một quản trị viên khác duyệt câu hỏi do bạn tạo.')).toBeInTheDocument();
  });
  it('lets teachers create codes and immediately lists students who have not practised',async()=>{
    const student={id:'new-student-uuid',mode:'adaptive',experimentGroup:'general',teacherId:'current-user',createdAt:'2026-10-22',total:0,confirmed:0,correct:0};
    const roster=vi.spyOn(ApiClient.prototype,'students').mockResolvedValueOnce({students:[],nextOffset:null}).mockResolvedValue({students:[student],nextOffset:null});
    const teachers=vi.spyOn(ApiClient.prototype,'teachers');
    const provision=vi.spyOn(ApiClient.prototype,'provision').mockResolvedValue({...student,token:'new-student-access-code'});
    mount(<Students/>);await screen.findByText('Chưa có học sinh trong danh sách');
    const user=userEvent.setup();
    await user.type(screen.getByLabelText('Họ và tên'),'Nguyễn Văn An');
    await user.type(screen.getByLabelText('Lớp'),'8A1');
    await user.click(screen.getByRole('button',{name:'Tạo mã cho học sinh'}));
    expect(await screen.findByText('new-student-access-code')).toBeInTheDocument();
    expect(await screen.findByText('Chưa làm bài')).toBeInTheDocument();
    expect(provision).toHaveBeenCalledWith('adaptive','general',undefined,'Nguyễn Văn An','8A1');expect(roster).toHaveBeenCalledTimes(2);expect(teachers).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Giáo viên phụ trách')).not.toBeInTheDocument();
  });
  it('loads teacher analytics through the scoped report endpoint',async()=>{
    const scoped=vi.spyOn(ApiClient.prototype,'learningReport').mockResolvedValue({rows:[{...demoResearch()[0],experimentGroup:'practice-check',reason:JSON.stringify({practiceContext:'student_selected_practice'})}],truncated:false});
    const global=vi.spyOn(ApiClient.prototype,'research');
    mount(<ResearchDashboard analytics/>);
    await waitFor(()=>expect(scoped).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Báo cáo chỉ gồm học sinh bạn phụ trách/)).toBeInTheDocument();
    expect(global).not.toHaveBeenCalled();
    expect(screen.getByRole('row',{name:/practice-check/})).toBeInTheDocument();
    expect(screen.getByRole('checkbox',{name:/Bao gồm cả bài luyện tập tự chọn/})).toBeChecked();
    await userEvent.setup().click(screen.getByRole('checkbox',{name:/Bao gồm cả bài luyện tập tự chọn/}));
    expect(screen.queryByRole('row',{name:/practice-check/})).not.toBeInTheDocument();
  });
  it('lets admins choose a teacher when creating a student code',async()=>{
    vi.spyOn(ApiClient.prototype,'students').mockResolvedValue({students:[],nextOffset:null});
    vi.spyOn(ApiClient.prototype,'teachers').mockResolvedValue({teachers:[{id:'teacher-1',label:'Giáo viên 1'}]});
    const provision=vi.spyOn(ApiClient.prototype,'provision').mockResolvedValue({id:'new',mode:'adaptive',experimentGroup:'general',token:'new-code'});
    mount(<Students/>,'admin');const user=userEvent.setup();
    await screen.findByRole('option',{name:'Giáo viên 1'});
    await user.type(screen.getByLabelText('Họ và tên'),'Nguyễn Văn An');
    await user.type(screen.getByLabelText('Lớp'),'8A1');
    await user.selectOptions(screen.getByLabelText('Giáo viên phụ trách'),'teacher-1');
    await user.click(screen.getByRole('button',{name:'Tạo mã cho học sinh'}));
    await waitFor(()=>expect(provision).toHaveBeenCalledWith('adaptive','general','teacher-1','Nguyễn Văn An','8A1'));
  });
});
