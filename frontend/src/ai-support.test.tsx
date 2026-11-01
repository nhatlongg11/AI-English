import {describe,it,expect,vi} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {AuthContext} from './features/auth/context';
import {StudyCoach} from './features/ai/StudyCoach';
import {AnswerHelp} from './features/ai/AnswerHelp';
import {TeacherAiTools} from './features/ai/TeacherTools';
import {AIStudio} from './features/teacher/AIStudio';
import {ApiClient} from './services/api';
import type {StudyPlanResult,InsightsResult,LessonPlanResult,ExplanationResult} from './types-ai';
import type {Role} from './types';

const statistics={availableAttempts:5,windowAttempts:5,windowLimit:500,registeredStudents:1,activeStudents:1,confirmed:4,correct:3,pending:1,byTense:[],availableContent:[{tense:'present_simple',count:3}]};
const source={model:'gemini-local-configured',provenance:'gemini',createdAt:'2026-10-28T07:00:00Z',cached:false};
const plan:StudyPlanResult={...source,context:{days:3,minutesPerDay:10,basis:'saved_progress',statistics},data:{summaryVi:'Ôn lại hiện tại đơn từng bước.',days:[1,2,3].map(day=>({day,tense:'present_simple',goalVi:'Nhận ra dạng động từ theo chủ ngữ.',activityVi:'Đọc công thức và làm vài câu đã duyệt.'})),encouragementVi:'Kiên trì một chút mỗi ngày nhé.'}};
const lesson:LessonPlanResult={...source,context:{tense:'past_simple',difficulty:2,minutes:30,focusError:'E04'},data:{titleVi:'Cùng luyện thì quá khứ đơn.',objectivesVi:['Nhận ra dấu hiệu thời gian.','Dùng đúng dạng quá khứ.'],activities:[{titleVi:'Khởi động',minutes:5,instructionsVi:'Quan sát một câu ví dụ.'},{titleVi:'Luyện tập',minutes:20,instructionsVi:'Luyện với câu hỏi trong kho đã duyệt.'},{titleVi:'Củng cố',minutes:5,instructionsVi:'Nói lại quy tắc đã học.'}],supportVi:'Cho xem bảng cấu trúc.',extensionVi:'Tự viết thêm một câu.',assessmentVi:'Kiểm tra cách giải thích.'}};
const insights:InsightsResult={...source,context:{statistics},data:{summaryVi:'Cần củng cố cấu trúc hiện tại đơn.',priorities:[{tense:'present_simple',errorCode:'E01',reasonVi:'Có lỗi hòa hợp đã được ghi nhận.',teachingActionVi:'Cho học sinh tìm chủ ngữ và chọn dạng động từ.'}],nextLessonVi:'Mở đầu bằng ví dụ ngắn đã kiểm tra.'}};
function mount(element:React.ReactNode,role:Role='student',path='/'){
  return render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{api:new ApiClient('real-test-code'),session:{role,actorId:role+'-test'},token:'real-test-code',login:vi.fn(),demo:vi.fn(),logout:vi.fn()}}>{element}</AuthContext.Provider></MemoryRouter>);
}
describe('AI learning and teaching tools',()=>{
  it('does not call Gemini on page load, generates a plan on request and links to real practice',async()=>{
    vi.spyOn(ApiClient.prototype,'supportHistory').mockResolvedValue({items:[]});const generate=vi.spyOn(ApiClient.prototype,'studyPlan').mockResolvedValue(plan);
    mount(<StudyCoach/>);expect(generate).not.toHaveBeenCalled();await userEvent.setup().click(screen.getByRole('button',{name:'Tạo kế hoạch với AI'}));
    expect(await screen.findByText(plan.data.summaryVi)).toBeInTheDocument();expect(generate).toHaveBeenCalledWith(3,10);
    expect(screen.getAllByRole('link',{name:'Luyện tập'})[0]).toHaveAttribute('href','/student/practice?adaptive=1&tense=present_simple');
    expect(screen.getByText(/4 đã chấm · 3 đúng · 1 chờ kiểm tra/)).toBeInTheDocument();
  });
  it('reopens the saved plan without another paid call and retains it if refresh fails',async()=>{
    vi.spyOn(ApiClient.prototype,'supportHistory').mockResolvedValue({items:[{...plan,cached:true}]});const generate=vi.spyOn(ApiClient.prototype,'studyPlan').mockRejectedValue(new Error('AI đang bận, thử lại sau.'));
    mount(<StudyCoach/>);expect(await screen.findByText(plan.data.summaryVi)).toBeInTheDocument();expect(generate).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button',{name:'Tạo kế hoạch với AI'}));expect(await screen.findByRole('alert')).toHaveTextContent('AI đang bận');expect(screen.getByText(plan.data.summaryVi)).toBeInTheDocument();
  });
  it('shows an explicit starter/mock label and avoids practice links for an empty question bank',async()=>{
    vi.spyOn(ApiClient.prototype,'supportHistory').mockResolvedValue({items:[{...plan,provenance:'mock',context:{...plan.context,basis:'starter_plan',statistics:{...statistics,confirmed:0,availableContent:[]}}}]});
    mount(<StudyCoach/>);expect(await screen.findByText('Nội dung mẫu mô phỏng')).toBeInTheDocument();expect(screen.getByText(/Đây là kế hoạch làm quen/)).toBeInTheDocument();expect(screen.queryByRole('link',{name:'Luyện tập'})).not.toBeInTheDocument();
  });
  it('explains a submitted answer only after clicking and prevents duplicate in-flight requests',async()=>{
    const response:ExplanationResult={...source,context:{correct:false},data:{ruleVi:'Đối chiếu chủ ngữ và động từ.',stepsVi:['Tìm chủ ngữ.','Xem dạng động từ.'],example:{sentence:'He reads every day.',meaningVi:'Bạn ấy đọc mỗi ngày.'},encouragementVi:'Em thử nói lại quy tắc nhé.'}};
    const explain=vi.spyOn(ApiClient.prototype,'explainAnswer').mockResolvedValue(response);
    mount(<AnswerHelp attemptId="attempt-1"/>);expect(explain).not.toHaveBeenCalled();
    await userEvent.setup().dblClick(screen.getByRole('button',{name:'Nhờ AI giải thích dễ hiểu hơn'}));expect(await screen.findByText(response.data.example.sentence)).toBeInTheDocument();expect(explain).toHaveBeenCalledTimes(1);expect(explain).toHaveBeenCalledWith('attempt-1');expect(screen.getByText(/không đổi điểm/)).toBeInTheDocument();
  });
  it('creates lesson plans and scoped insights on request, with draft-generation links',async()=>{
    vi.spyOn(ApiClient.prototype,'supportHistory').mockResolvedValue({items:[]});
    const create=vi.spyOn(ApiClient.prototype,'lessonPlan').mockResolvedValue(lesson);const analyse=vi.spyOn(ApiClient.prototype,'classInsights').mockResolvedValue(insights);
    mount(<TeacherAiTools/>,'teacher');expect(create).not.toHaveBeenCalled();expect(analyse).not.toHaveBeenCalled();const user=userEvent.setup();
    await user.click(screen.getByRole('button',{name:'Tạo giáo án với AI'}));expect(await screen.findByText(lesson.data.titleVi)).toBeInTheDocument();expect(create).toHaveBeenCalledWith({tense:'present_simple',difficulty:1,minutes:45,focusError:null});
    expect(screen.getByRole('link',{name:'Soạn câu hỏi theo giáo án'})).toHaveAttribute('href','/teacher/ai-studio?tense=past_simple&difficulty=2&target=E04');
    await user.click(screen.getByRole('button',{name:'Nhờ AI gợi ý nội dung ôn tập'}));expect(await screen.findByText(insights.data.summaryVi)).toBeInTheDocument();expect(screen.getByRole('link',{name:'Soạn câu ôn tập'})).toHaveAttribute('href','/teacher/ai-studio?tense=present_simple&target=E01');
    expect(screen.getByText(/Câu hỏi vẫn cần admin duyệt/)).toBeInTheDocument();
  });
  it('surfaces insufficient class data without displaying fabricated insights',async()=>{
    vi.spyOn(ApiClient.prototype,'supportHistory').mockResolvedValue({items:[]});vi.spyOn(ApiClient.prototype,'classInsights').mockRejectedValue(new Error('Chưa có câu trả lời đã chấm.'));
    mount(<TeacherAiTools/>,'teacher');await userEvent.setup().click(screen.getByRole('button',{name:'Nhờ AI gợi ý nội dung ôn tập'}));expect(await screen.findByRole('alert')).toHaveTextContent('Chưa có câu trả lời đã chấm');expect(screen.queryByText(insights.data.summaryVi)).not.toBeInTheDocument();
  });
  it('preselects AI Studio from teaching suggestions and still requires explicit generation',async()=>{
    vi.spyOn(ApiClient.prototype,'health').mockResolvedValue({status:'ok',aiMode:'gemini'});const generate=vi.spyOn(ApiClient.prototype,'generate').mockResolvedValue({questions:[]});
    mount(<AIStudio/>,'teacher','/teacher/ai-studio?tense=past_simple&difficulty=2&target=E04');expect(generate).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button',{name:'Tạo câu hỏi nháp'}));await waitFor(()=>expect(generate).toHaveBeenCalledWith(expect.objectContaining({tense:'past_simple',difficulty:2,targetErrorCode:'E04'})));
  });
});
