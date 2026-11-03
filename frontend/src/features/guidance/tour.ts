import Shepherd, { type Tour } from 'shepherd.js';
import type { Role } from '../../types';
import 'shepherd.js/dist/css/shepherd.css';
import './tour.css';

interface GuideStep { title: string; text: string; target?: string }
const target = (name: string) => `[data-guide="${name}"]`;

function pageSteps(path: string, role: Role): GuideStep[] {
  if(path==='/student/ai-coach')return [
    {title:'Một kế hoạch vừa sức',text:'Chọn số ngày và thời gian, rồi bấm tạo kế hoạch. AI dùng kết quả đã lưu, không tự chấm lại bài của bạn.',target:target('ai-coach')},
    {title:'Làm từng bước nhỏ',text:'Mỗi ngày có mục tiêu, hoạt động và đường dẫn bài học. Kế hoạch được lưu để bạn xem lại mà không cần tạo lại.',target:target('ai-plan')},
  ];
  if(path==='/teacher/ai-tools')return [
    {title:'Chuẩn bị giáo án',text:'Chọn thì, độ khó và thời lượng. Đọc lại các hoạt động AI gợi ý trước khi dùng trong buổi học.',target:target('ai-lesson-plan')},
    {title:'Tìm điều cần ôn',text:'AI gợi ý từ thống kê học sinh được cấp quyền, không dùng tên hay lớp. Câu chờ kiểm tra không bị tính sai.',target:target('ai-teaching-insights')},
  ];
  if(path==='/teacher/attendance')return [
    {title:'Mở sổ cho từng buổi học',text:'Đặt tên, chọn ngày và những em có trong buổi học. Đăng nhập vào app không tự tính là có mặt.',target:target('lesson-create')},
    {title:'Chọn buổi muốn điểm danh',text:'Bạn có thể quay lại những buổi trước để kiểm tra hoặc sửa ghi nhận.',target:target('lesson-list')},
    {title:'Ghi nhận rồi lưu',text:'Chọn Có mặt, Vắng, Đi muộn hoặc Có phép cho từng em. Chưa điểm danh được giữ riêng; nhớ bấm Lưu điểm danh.',target:target('attendance-register')},
  ];
  if(path==='/teacher/lesson-reports')return [
    {title:'Chọn buổi cần báo cáo',text:'Chọn một hoặc nhiều buổi. Điểm danh và danh sách học sinh được lấy từ sổ đã lưu.',target:target('report-picker')},
    {title:'Ghi nhận kết quả thật',text:'Bấm Nhập / sửa kết quả để ghi bài tập, số từ thuộc và điểm mini test. Để trống nếu chưa kiểm tra; số 0 là điểm đã kiểm tra.',target:target('lesson-report')},
    {title:'Lưu rồi chia sẻ',text:'Lưu kết quả trước khi bấm In / Lưu PDF. Báo cáo có họ tên và điểm cả lớp, nên chỉ gửi cho người được phép xem.'},
  ];
  if(path==='/teacher/exercises')return [
    {title:'Bắt đầu với người nhận',text:'Bấm Tạo bài tập mới. Ở bước 1, chọn lớp và những học sinh sẽ nhận bài. Bạn có thể chọn cả lớp hoặc từng em.',target:'.page-heading'},
    {title:'Chuẩn bị theo từng bước',text:'Bước 2: lọc và chọn câu hỏi đã duyệt, rồi sắp xếp thứ tự. Bước 3: đặt tên bài và thêm lời dặn. Bạn có thể quay lại mà không mất lựa chọn.',target:target('exercise-compose')},
    {title:'Xem lại rồi giao bài',text:'Bước 4 hiển thị người nhận và toàn bộ câu hỏi. Bấm Giao bài ngay để gửi; hoặc Lưu bản nháp để hoàn thiện sau. Câu chờ duyệt chỉ được lưu nháp.',target:target('exercise-detail')},
  ];
  if(path.startsWith('/student/exercises'))return [{title:'Bài dành cho bạn',text:'Mở bài thầy cô giao và làm từng câu. Mỗi câu nộp xong được lưu ngay; bạn có thể quay lại làm tiếp.'}];
  if (path === '/teacher/students') return [
    {title:'Một mã riêng cho mỗi học sinh',text:'Nhập họ tên và lớp để dễ nhận ra em khi điểm danh và giao bài. Học sinh dùng mã riêng để đăng nhập, không cần email.',target:target('student-account')},
    {title:'Chọn cách giao bài',text:'“Theo sức học” chọn bài dựa vào những câu em đã làm. “Theo thứ tự” giữ một thứ tự bài cố định. Nếu chưa có yêu cầu riêng, chọn cách đầu tiên.',target:target('learning-path')},
    {title:'Chưa cần chia nhóm? Cứ bỏ qua.',text:'Phần này chỉ dùng để gắn nhãn khi so sánh các nhóm trong một đợt đánh giá. Nhãn nhóm không phải là lớp học.',target:target('evaluation-options')},
    {title:'Tạo mã rồi gửi riêng cho em',text:'Sau khi tạo, hãy sao chép mã ngay. Học sinh dán mã vào trang đăng nhập là có thể bắt đầu. Hướng dẫn này không tạo tài khoản thay bạn.',target:target('create-student')},
    {title:'Danh sách học sinh của bạn',text:'Mã mới xuất hiện ngay, kể cả khi học sinh chưa làm bài. Giáo viên chỉ thấy học sinh mình phụ trách.',target:target('student-activity')},
  ];
  if (path.startsWith('/teacher/ai-studio')) return [
    {title:'Bắt đầu từ bài muốn dạy',text:'Chọn thì, dạng bài và độ khó. Bạn có thể tạo vài câu cùng lúc rồi kiểm tra từng câu.',target:target('question-settings')},
    {title:'Gợi ý chủ đề quen thuộc',text:'Ví dụ: trường học, gia đình hay sở thích. Phần này không bắt buộc.',target:'#studio-theme'},
    {title:'Tạo bản nháp để kiểm tra',text:'AI tạo gợi ý, chưa đưa thẳng cho học sinh. Bản nháp sẽ chờ quản trị viên duyệt trong Ngân hàng câu hỏi.',target:target('generate-questions')},
  ];
  if (path.startsWith('/teacher/question-bank')) return [
    {title:'Dùng câu hỏi của chính thầy cô',text:'Chọn Tự soạn để viết một câu, hoặc Nhập từ tệp để tải mẫu và thêm nhiều câu cùng lúc. Cả hai đều lưu bản nháp, không gọi AI.',target:target('bank-authoring')},
    {title:'Tìm câu hỏi bạn cần',text:'Chọn thì và trạng thái để tìm bài nhanh hơn. “Chờ duyệt” là những câu học sinh chưa được nhận.',target:target('bank-filters')},
    {title:'Đọc kỹ trước khi dùng',text:'Mở một câu để kiểm tra đề bài, đáp án và giải thích. Quản trị viên sẽ duyệt câu hỏi trước khi xuất bản; người tạo cần một quản trị viên khác duyệt.',target:target('question-list')},
  ];
  if (path.includes('/analytics') || path.startsWith('/research')) return [
    {title:'Chọn phần kết quả muốn xem',text:'Bạn có thể xem theo cách giao bài, chủ đề hoặc nhãn nhóm. Đây là kết quả luyện tập, chưa phải bài kiểm tra trước và sau khóa học.',target:target('report-filters')},
    {title:'Đọc các con số cùng nhau',text:'Độ chính xác chỉ tính câu đã chấm. Câu đang chờ kiểm tra được đếm riêng, không bị tính là sai.',target:target('report-stats')},
  ];
  if (path.startsWith('/teacher/dashboard')) return [
    {title:'Soạn bài với một chút trợ giúp',text:'Chọn “Tạo học liệu mới” để nhờ AI gợi ý câu hỏi. Quản trị viên kiểm tra và duyệt trước khi học sinh nhận bài.',target:'.hero'},
    {title:'Biết bài nào đã sẵn sàng',text:'Xem nhanh số câu chờ kiểm tra và số câu đã duyệt trong phần kho đang hiển thị.',target:target('teacher-stats')},
    {title:'Bước tiếp theo rất đơn giản',text:role === 'admin' ? 'Vào Học sinh để tạo mã đăng nhập cho từng em. Sau khi các em làm bài, bạn có thể xem báo cáo.' : 'Vào Học sinh để tạo mã cho từng em. Xem kết quả của các em trong Phân tích học tập.'},
  ];
  if (path.startsWith('/student/practice/result')) return [
    {title:'Nhìn lại buổi luyện tập',text:'Xem câu đã đúng và đọc lại giải thích cho câu cần luyện thêm. Câu chờ kiểm tra chưa bị tính sai.'},
  ];
  if (path.startsWith('/student/practice')) return [
    {title:'Luyện từng chút, không cần vội',text:'Mỗi lượt có tối đa 5 câu và không tính giờ. Bạn có thể chọn chủ đề trước khi bắt đầu.',target:target('practice-setup')},
    {title:'Chọn câu trả lời của bạn',text:'Với bài xếp câu, kéo từ hoặc dùng nút mũi tên để sắp xếp. Với bài điền từ hay sửa lỗi, nhập câu trả lời vào ô.',target:target('practice-answer')},
    {title:'Đọc giải thích rồi đi tiếp',text:'Nộp câu trả lời để xem giải thích. Nếu cách diễn đạt cần thầy cô kiểm tra, câu đó sẽ được ghi là chờ kiểm tra, không tự động tính sai.',target:target('practice-feedback')},
  ];
  if (path.startsWith('/student/progress')) return [
    {title:'Tiến bộ từ chính bài bạn đã làm',text:'Mỗi câu đúng được xác nhận nhận 10 điểm. Câu đang chờ kiểm tra không được đưa vào tỷ lệ đúng.',target:target('progress-stats')},
    {title:'Biết mình cần luyện gì tiếp',text:'Xem kỹ năng và lỗi thường gặp để chọn bài ôn. Chưa có biểu đồ? Hãy hoàn thành vài câu đầu tiên.'},
  ];
  if (path.startsWith('/student/grammar')) return [
    {title:'Hiểu trước, luyện sau',text:'Mở một chủ đề để đọc công thức và ví dụ. Khi thấy sẵn sàng, chọn bài luyện của chủ đề đó.',target:'.topic-grid'},
  ];
  if (path.startsWith('/student/dashboard')) return [
    {title:'Không biết bắt đầu từ đâu?',text:'Bấm “Tiếp tục học” để nhận bài theo cách giao bài của bạn. Tất cả câu hỏi đều từ kho đã duyệt.',target:'.hero'},
    {title:'Chọn một chủ đề muốn ôn',text:'Bạn có thể đọc công thức và ví dụ, rồi luyện thì hiện tại đơn, hiện tại tiếp diễn hoặc quá khứ đơn.',target:'.topic-grid'},
    {title:'Mỗi lần luyện đều được ghi lại',text:'Điểm và độ chính xác đến từ những câu bạn đã làm. Bạn có thể nhìn lại kết quả trong Tiến bộ của bạn.',target:target('student-stats')},
  ];
  return [{title:'Bạn luôn có thể xem lại hướng dẫn',text:'Mở trang cần tìm hiểu rồi bấm Hướng dẫn ở góc trên. Bạn có thể đóng bất cứ lúc nào và tiếp tục công việc đang làm.'}];
}

function visibleTarget(selector: string) {
  return [...document.querySelectorAll<HTMLElement>(selector)].find(element => {
    const style = window.getComputedStyle(element);
    return element.getClientRects().length > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  });
}

export function createPageTour(path: string, role: Role, onFinish: () => void): Tour {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tour = new Shepherd.Tour({
    tourName:'tenselab-help', useModalOverlay:true, exitOnEsc:true, keyboardNavigation:true,
    defaultStepOptions:{
      classes:'tenselab-tour', cancelIcon:{enabled:true,label:'Đóng hướng dẫn'},
      scrollTo:{behavior:reducedMotion ? 'auto' : 'smooth',block:'center'},
      modalOverlayOpeningPadding:8, modalOverlayOpeningRadius:18,
      canClickTarget:false,
    },
  });
  const steps: GuideStep[] = [
    {title:role === 'student' ? 'Cùng làm quen nhé!' : 'Một vòng làm quen, thật nhẹ nhàng',text:'Mình sẽ chỉ bạn những chỗ hữu ích trên trang này. Chỉ mất khoảng một phút. Bạn có thể bấm Bỏ qua hoặc nhấn Esc bất cứ lúc nào.'},
    ...pageSteps(path,role),
    {title:'Bạn đã sẵn sàng rồi',text:'Bạn cứ thử từng bước, theo nhịp của mình. Khi cần, bấm Hướng dẫn để xem lại hoặc mở Trợ giúp để đọc thêm.',target:target('guide-replay')},
  ];
  // Missing targets (loading, a closed panel, or mobile navigation) are skipped on show.
  steps.forEach((step,index) => {
    const text = document.createElement('div');
    const counter = document.createElement('p');
    counter.className='tour-progress';counter.textContent=`Bước ${index+1} / ${steps.length}`;
    const content = document.createElement('p');content.textContent=step.text;
    text.append(counter,content);
    tour.addStep({
      id:`tenselab-step-${index}`,title:step.title,text,
      when:{show:() => {
        const available=steps.filter(item => !item.target || visibleTarget(item.target));
        counter.textContent=`Bước ${available.indexOf(step)+1} / ${available.length}`;
      }},
      ...(step.target ? {attachTo:{element:() => visibleTarget(step.target!)!,on:'bottom' as const},showOn:() => Boolean(visibleTarget(step.target!))} : {}),
      buttons:[
        {text:'Bỏ qua',classes:'tour-skip',action:() => {void tour.cancel();}},
        ...(index>0 ? [{text:'Quay lại',secondary:true,action:() => tour.back()}] : []),
        {text:index === steps.length-1 ? 'Bắt đầu thôi' : index === 0 ? 'Xem hướng dẫn' : 'Tiếp theo',action:() => index === steps.length-1 ? tour.complete() : tour.next()},
      ],
    });
  });
  tour.on('cancel',onFinish);tour.on('complete',onFinish);
  return tour;
}
