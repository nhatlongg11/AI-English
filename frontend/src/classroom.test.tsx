import {describe,it,expect,vi} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {AuthContext} from './features/auth/context';
import {Attendance} from './features/teacher/Attendance';
import {Exercises} from './features/teacher/Exercises';
import {AssignedExercisePlayer,AssignedExercises} from './features/learning/AssignedExercises';
import {ApiClient} from './services/api';
import {demoBank} from './services/demo';
import type {Role,LessonDetail,ExerciseDetail,Feedback} from './types';
import {studentLabel} from './lib/student-identity';

const student={id:'student-1',displayName:'Minh Anh',className:'8A1',teacherId:'teacher-test',mode:'adaptive',experimentGroup:'general',createdAt:'2026-10-28',total:0,confirmed:0,correct:0};
const lesson:LessonDetail={id:'lesson-1',title:'Buổi ôn tập',heldOn:'2026-10-28',createdBy:'teacher-test',createdAt:'2026-10-28',total:1,marked:0,reportClassName:null,vocabularyTotal:null,records:[{studentId:student.id,student,status:'unmarked',markedAt:null,markedBy:null,homeworkStatus:'unmarked',vocabularyKnown:null,miniTestScore:null,reportedAt:null,reportedBy:null}]};
const exercise:ExerciseDetail={id:'exercise-1',title:'Bài tập tuần 1',instructions:'Đọc kỹ đề.',publishedAt:null,questionCount:1,studentCount:1,questions:[{questionId:demoBank[0].id,position:0,question:{...demoBank[0],status:'approved'}}],recipients:[{studentId:student.id,student,answered:0,correct:0,pending:0}]};
function mount(element:React.ReactNode,role:Role='teacher',path='/'){
  const api=new ApiClient('real-account-test');return render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{api,session:{role,actorId:'teacher-test'},token:'real-account-test',login:vi.fn(),demo:vi.fn(),logout:vi.fn()}}>{element}</AuthContext.Provider></MemoryRouter>);
}
describe('attendance and assigned exercise screens',()=>{
  it('creates a lesson, keeps attendance unmarked and saves an explicit teacher choice',async()=>{
    vi.spyOn(ApiClient.prototype,'students').mockResolvedValue({students:[student],nextOffset:null});
    vi.spyOn(ApiClient.prototype,'lessons').mockResolvedValue({lessons:[],nextOffset:null});
    const create=vi.spyOn(ApiClient.prototype,'createLesson').mockResolvedValue({lesson});
    vi.spyOn(ApiClient.prototype,'lesson').mockResolvedValue({lesson});
    const mark=vi.spyOn(ApiClient.prototype,'markAttendance').mockResolvedValue({lesson});
    mount(<Attendance/>);const user=userEvent.setup();
    await user.type(screen.getByLabelText('Tên buổi học'),'Buổi ôn tập');
    await user.click(await screen.findByRole('checkbox',{name:/Minh Anh/}));
    await user.click(screen.getByRole('button',{name:'Tạo sổ điểm danh'}));
    await waitFor(()=>expect(create).toHaveBeenCalledWith(expect.objectContaining({title:'Buổi ôn tập',studentIds:['student-1']})));
    const choice=await screen.findByRole('combobox',{name:`Điểm danh ${studentLabel(student)}`});expect(choice).toHaveValue('unmarked');expect(mark).not.toHaveBeenCalled();
    await user.selectOptions(choice,'present');await user.click(screen.getByRole('button',{name:'Lưu điểm danh'}));
    await waitFor(()=>expect(mark).toHaveBeenCalledWith('lesson-1',[{studentId:'student-1',status:'present'}]));
  });
  it('builds an exercise using selected questions and students, then explicitly assigns it',async()=>{
    vi.spyOn(ApiClient.prototype,'students').mockResolvedValue({students:[student],nextOffset:null});
    vi.spyOn(ApiClient.prototype,'questions').mockResolvedValue({questions:[exercise.questions[0].question]});
    vi.spyOn(ApiClient.prototype,'exercises').mockResolvedValue({exercises:[],nextOffset:null});
    const save=vi.spyOn(ApiClient.prototype,'saveExercise').mockResolvedValue({exercise});
    vi.spyOn(ApiClient.prototype,'exercise').mockResolvedValue({exercise});const publish=vi.spyOn(ApiClient.prototype,'publishExercise').mockResolvedValue({exercise});
    mount(<Exercises/>);const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Tạo bài tập mới'}));
    await user.click(await screen.findByRole('checkbox',{name:/Minh Anh/}));
    await user.click(screen.getByRole('button',{name:'Tiếp tục: Chọn câu hỏi'}));
    await user.click(await screen.findByRole('checkbox',{name:new RegExp(exercise.questions[0].question.content.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}));
    await user.click(screen.getByRole('button',{name:'Tiếp tục: Đặt tên bài'}));
    await user.type(screen.getByLabelText(/Tên bài tập/),'Bài tập tuần 1');
    await user.click(screen.getByRole('button',{name:'Tiếp tục: Kiểm tra & giao'}));
    expect(save).not.toHaveBeenCalled();expect(publish).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button',{name:'Giao bài ngay'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({title:'Bài tập tuần 1',instructions:'',questionIds:[demoBank[0].id],studentIds:['student-1']},undefined));
    await waitFor(()=>expect(publish).toHaveBeenCalledWith('exercise-1'));
  });
  it('blocks assignment when a selected question still awaits admin approval',async()=>{
    vi.spyOn(ApiClient.prototype,'students').mockResolvedValue({students:[],nextOffset:null});vi.spyOn(ApiClient.prototype,'questions').mockResolvedValue({questions:[]});
    vi.spyOn(ApiClient.prototype,'exercises').mockResolvedValue({exercises:[exercise],nextOffset:null});
    vi.spyOn(ApiClient.prototype,'exercise').mockResolvedValue({exercise:{...exercise,questions:[{...exercise.questions[0],question:{...exercise.questions[0].question,status:'draft'}}]}});
    const publish=vi.spyOn(ApiClient.prototype,'publishExercise');mount(<Exercises/>);await userEvent.setup().click(await screen.findByRole('button',{name:/Bài tập tuần 1/}));
    expect(await screen.findByRole('button',{name:'Giao bài cho học sinh'})).toBeDisabled();expect(screen.getByText(/Có câu đang chờ duyệt/)).toBeInTheDocument();expect(publish).not.toHaveBeenCalled();
  });
  it('student list shows saved progress and provides a resume link',async()=>{
    vi.spyOn(ApiClient.prototype,'exercises').mockResolvedValue({exercises:[{...exercise,answered:1,questionCount:2,correct:1,pending:0}],nextOffset:null});
    mount(<AssignedExercises/>,'student');expect(await screen.findByText('1/2 câu đã nộp')).toBeInTheDocument();expect(screen.getByRole('link',{name:'Làm tiếp'})).toHaveAttribute('href','/student/exercises/exercise-1');
  });
  it('submits one answer, shows stored feedback and retrieves completion from the server',async()=>{
    const {correctAnswer,options,...q}=demoBank[0];
    vi.spyOn(ApiClient.prototype,'exerciseNext').mockResolvedValueOnce({exercise:{id:'exercise-1',title:'Bài tập tuần 1',instructions:'',total:1,answered:0},completed:false,decisionId:'decision-1',question:{...q,options:options.map(o=>o.text)}}).mockResolvedValue({exercise:{id:'exercise-1',title:'Bài tập tuần 1',instructions:'',total:1,answered:1},completed:true,question:null});
    const submit=vi.spyOn(ApiClient.prototype,'submit').mockResolvedValue({correct:true,correctAnswer,explanationVi:'Giải thích đã lưu.'} as Feedback);
    mount(<Routes><Route path="/student/exercises/:id" element={<AssignedExercisePlayer/>}/></Routes>,'student','/student/exercises/exercise-1');const user=userEvent.setup();
    await user.click(await screen.findByRole('button',{name:`A. ${options[0].text}`}));await user.dblClick(screen.getByRole('button',{name:'Nộp câu trả lời'}));
    expect(await screen.findByText('Giải thích đã lưu.')).toBeInTheDocument();expect(submit).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button',{name:'Xem hoàn thành'}));expect(await screen.findByText('Bạn đã hoàn thành bài tập!')).toBeInTheDocument();
  });
});
