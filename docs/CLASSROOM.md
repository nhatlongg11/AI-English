# Điểm danh và giao bài tập

## Điểm danh

Đăng nhập bằng mã Teacher, mở **Điểm danh** từ menu hoặc trang Tổng quan.

1. Nhập tên buổi, ngày học và chọn học sinh; bấm **Tạo sổ điểm danh**. Danh sách được lưu riêng cho buổi này.
2. Chọn **Có mặt**, **Vắng**, **Đi muộn** hoặc **Có phép** cho từng em. Mặc định là **Chưa điểm danh**, không phải Vắng.
3. Bấm **Lưu điểm danh**. Có thể sửa hoặc đưa về Chưa điểm danh. Hệ thống lưu người ghi nhận và thời gian mới nhất; chưa có nhật ký đầy đủ mọi lần chỉnh sửa.
4. Lưu hoặc hủy thay đổi trước khi chuyển buổi. Đóng/tải lại trang sẽ nhắc nếu chưa lưu. Rời sang mục khác trong app không tự lưu.

Điểm danh do giáo viên ghi nhận; **đăng nhập hoặc làm bài không tự tính là có mặt**. Ngày mặc định theo Asia/Bangkok. Ngày không tồn tại bị từ chối.

Học sinh hiển thị theo dạng **student_họ_và_tên_lớp_ID_ngắn**, ví dụ `student_Nguyễn_Văn_An_8A1_cd6955f0`. Giữ dấu tiếng Việt, thay khoảng trắng bằng `_`, dùng 8 ký tự đầu của UUID. Đây là nhãn hiển thị; UUID, mã đăng nhập, quan hệ dữ liệu và tiến độ không đổi.

Form tạo mã yêu cầu **Họ và tên** và **Lớp**. Bấm **Sửa họ tên và lớp** trong mục Học sinh hoặc ngay trong danh sách chọn học sinh để cập nhật. Sửa thông tin không tự chọn học sinh hoặc tạo buổi học. Có thể tìm theo tên, lớp hoặc ID, không cần gõ dấu. Nhãn nhóm phục vụ đánh giá không còn hiện trong bộ chọn. Lớp ở đây là thông tin nhận diện, chưa tạo nhóm lớp hoặc tự động phân công học sinh.

Tài khoản cũ chưa đủ thông tin hiển thị rõ `chưa_nhập_tên` / `chưa_nhập_lớp`, không đoán tên hay lớp. Hai tài khoản seed đã có tên **Học sinh thử 1/2**, lớp **Lớp thử**, theo lựa chọn của người dùng. Seed lại giữ nguyên tên/lớp đã sửa. Tên/lớp không gửi cho Gemini và không nằm trong export nghiên cứu.

## Tạo và giao bài

Mở **Giao bài tập → Tạo bài tập mới**.

1. Đặt tên, thêm lời dặn, chọn câu trong kho theo thứ tự muốn giao. Bấm **Tự soạn câu hỏi cho bài này** để viết thêm câu ngay trong app.
2. Chọn học sinh nhận bài, bấm **Lưu bài nháp**. Tối đa 100 câu và 100 học sinh mỗi bài. Bộ chọn có phân trang, giữ lựa chọn giữa các trang; tìm kiếm áp dụng cho trang đang mở.
3. Xem lại hoặc sửa bản nháp. Câu mới chờ quản trị viên duyệt trong Ngân hàng câu hỏi; giáo viên không tự duyệt được. Bấm **Cập nhật kết quả** sau khi admin duyệt.
4. Khi tất cả câu đã duyệt, bấm **Giao bài cho học sinh**. Bản nháp không hiện ở phía học sinh. Bài đã giao giữ nguyên nội dung/người nhận để bảo toàn kết quả; tạo bài mới khi cần thay đổi.

Học sinh mở **Bài thầy cô giao** để bắt đầu/làm tiếp. Mỗi câu nộp xong được lưu; tải lại không làm mất tiến độ hoặc tạo quyết định mới cho câu chưa trả lời. Mỗi câu trong bài chỉ nộp một lần. Bài luyện thông thường và bài thầy cô giao được tách riêng.

Giáo viên xem số câu đã nộp, đúng và đang chờ kiểm tra. Trắc nghiệm chấm theo key đã duyệt; điền từ/sửa lỗi giữ quy trình key/advisory hiện có. Cách trả lời tự do khác đáp án có thể chờ kiểm tra, không tự tính sai. Chưa có hạn nộp hoặc giới hạn giờ cho bài tập.

## Phân quyền và dữ liệu

Giáo viên chỉ chọn học sinh mình phụ trách, chỉ mở sổ/bài do mình tạo; admin quản lý toàn hệ thống. API kiểm tra quyền, không chỉ ẩn nút. Khi chuyển học sinh sang giáo viên khác, giáo viên cũ không còn thấy em trong điểm danh/tiến độ; bài đã giao vẫn còn để học sinh làm tiếp, admin giữ quyền xem. Bài nháp có người nhận đã chuyển đi phải được sửa trước khi giao.

Migration `20261028000000_lessons_exercises` thêm bảng sổ/điểm danh/bài/người nhận, Student.displayName và SelectionDecision.exerciseId. Máy local đã migrate/generate. Bản cài đặt khác chạy `npm run db:migrate`, `npm run db:generate`, khởi động lại backend. Không tự tạo điểm danh, đổi tiến độ, thay mã đăng nhập hoặc cấu hình Gemini.

Lượt làm bài có algorithm `teacher-exercise-v1`, practiceContext `teacher_assigned_exercise`. Phân tích học tập hiển thị mặc định. Nghiên cứu & đánh giá mặc định loại các lượt này và bài tự chọn khỏi so sánh lộ trình, có lựa chọn xem thêm; export giữ nguồn gốc để phân biệt.

## API

Prefix `/api/v1`, Bearer token. Danh sách hỗ trợ limit 1–100 (mặc định 30), offset và nextOffset. Body strict, không nhận metadata người tạo/ghi nhận từ client.

| Endpoint | Quyền và body |
| --- | --- |
| PATCH `/learning/students/:id/profile` | Teacher phụ trách/admin; `{displayName?: string hoặc null, className?: string hoặc null}; ít nhất một trường` |
| GET/POST `/teaching/lessons` | Teacher/admin; POST `{title, heldOn: YYYY-MM-DD, studentIds}` |
| GET `/teaching/lessons/:id` | Chủ sổ/admin; trạng thái và dấu thời gian |
| PATCH `/teaching/lessons/:id/attendance` | Chủ sổ/admin; `{records: [{studentId,status}]}`, transaction |
| GET/POST `/teaching/exercises` | Teacher/admin; POST `{title,instructions,questionIds,studentIds}` tạo draft |
| GET/PATCH `/teaching/exercises/:id` | Chủ bài/admin; PATCH cùng body tạo, chỉ khi còn draft |
| POST `/teaching/exercises/:id/publish` | Chủ bài/admin; kiểm tra approval/quyền học sinh, idempotent |
| GET `/learning/exercises` | Student; chỉ bài đã giao cho chính mình, có tiến độ |
| GET `/learning/exercises/:id/next-question` | Student nhận bài; câu tiếp theo hoặc completed, không key |
| POST `/learning/attempts` | Nộp decisionId nhận từ bài, cùng grading/feedback hiện có |

Status: unmarked/present/absent/late/excused. Các lỗi chính: 403 quyền, 404 không thuộc quyền, 409 QUESTIONS_AWAITING_APPROVAL hoặc EXERCISE_PUBLISHED.

## Xác minh

Ngày 28/10/2026: **103 backend tests + 42 frontend tests đều qua**, cùng type checks, production builds và kiểm tra credential không có trong client bundle. Các test nhận diện mới kiểm tra nhãn có họ tên/lớp/ID, dấu tiếng Việt, dữ liệu cũ chưa đầy đủ, tìm không dấu và sửa hồ sơ ngay trong bộ chọn mà không vô tình gửi form buổi học.

Tests kiểm tra phân quyền, trạng thái mặc định, lưu/sửa điểm danh, ngày sai, metadata giả, rollback, chuyển giáo viên, draft chưa lộ, admin approval, thứ tự, làm tiếp, nộp một lần và tiến độ. UI được kiểm tra bằng component thật; ApiClient được kiểm tra với Fastify/SQLite.

`npm run test:live:classroom` đã qua Vite → Fastify → SQLite hiện tại, dùng câu Gemini đã duyệt: lưu điểm danh, giao bài, nộp câu được chấm đúng và đối chiếu tiến độ trong database. **Không gọi AI mới**. Sổ, bài và học sinh tạm đã được dọn; dữ liệu cũ giữ nguyên. Bằng chứng không có credential: `.tmp/classroom-verification.json`. Chưa có xác minh click-through trình duyệt trực quan mới.

Migration `20261028010000_student_class` thêm Student.className nullable; chạy migrate/generate khi cập nhật bản cài đặt khác. POST /learning/students nhận thêm displayName/className; API vẫn cho phép bỏ trống để tương thích công cụ cấp mã cũ. Profile PATCH từng trường giữ nguyên trường còn lại.
