import {describe,it,expect,vi} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {studentLabel} from './lib/student-identity';
import {StudentProfile} from './features/teacher/StudentProfile';
import {RosterPicker} from './features/teacher/ClassroomShared';
import {AuthContext} from './features/auth/context';
import {ApiClient} from './services/api';

const student={id:'cd6955f0-2a51-49c3-ba9d-405264a99797',displayName:'Nguyễn Văn An',className:'8A1',teacherId:'teacher-test',mode:'adaptive',experimentGroup:'internal_evaluation_group',createdAt:'2026-10-28',total:0,confirmed:0,correct:0};
function mount(ui:React.ReactNode){return render(<AuthContext.Provider value={{api:new ApiClient('test-token'),session:{role:'teacher',actorId:'teacher-test'},token:'test-token',login:vi.fn(),demo:vi.fn(),logout:vi.fn()}}>{ui}</AuthContext.Provider>);}
describe('readable student identity',()=>{
  it('uses full name, class and stable short ID while preserving Vietnamese spelling',()=>{
    expect(studentLabel(student)).toBe('student_Nguyễn_Văn_An_8A1_cd6955f0');
    expect(studentLabel({...student,displayName:'  Nguyễn   Văn_An ',className:' 8 A1 '})).toBe('student_Nguyễn_Văn_An_8_A1_cd6955f0');
    expect(student.id).toBe('cd6955f0-2a51-49c3-ba9d-405264a99797');
    expect(studentLabel({...student,id:'8fecf8d3-other'})).not.toBe(studentLabel(student));
  });
  it('clearly flags missing legacy data without inventing a name or class',()=>{
    expect(studentLabel({id:student.id})).toBe('student_chưa_nhập_tên_chưa_nhập_lớp_cd6955f0');
  });
  it('saves name and class from the picker without accidentally submitting the lesson form',async()=>{
    const saved=vi.spyOn(ApiClient.prototype,'studentName').mockResolvedValue({});const outer=vi.fn();const reload=vi.fn();
    mount(<form onSubmit={outer}><StudentProfile student={student} onSaved={reload}/></form>);
    const user=userEvent.setup();await user.click(screen.getByRole('button',{name:/Sửa họ tên và lớp/}));
    await user.clear(screen.getByLabelText('Họ và tên'));await user.type(screen.getByLabelText('Họ và tên'),'Trần Bình');
    await user.clear(screen.getByLabelText('Lớp'));await user.type(screen.getByLabelText('Lớp'),'9B');
    expect(screen.getByText(/student_Trần_Bình_9B_cd6955f0/)).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Lưu thông tin'}));
    await waitFor(()=>expect(saved).toHaveBeenCalledWith(student.id,'Trần Bình','9B'));expect(reload).toHaveBeenCalled();expect(outer).not.toHaveBeenCalled();
  });
  it('finds students by name without accents or by class and hides experiment codes',async()=>{
    vi.spyOn(ApiClient.prototype,'students').mockResolvedValue({students:[student],nextOffset:null});
    mount(<RosterPicker selected={[]} onChange={vi.fn()}/>);const user=userEvent.setup();await screen.findByRole('checkbox');
    expect(screen.queryByText(/internal_evaluation_group/)).not.toBeInTheDocument();
    const search=screen.getByRole('textbox',{name:'Tìm học sinh trong trang'});
    await user.type(search,'nguyen van an');expect(screen.getByRole('checkbox')).toBeInTheDocument();
    await user.clear(search);await user.type(search,'8A1');expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });
});
