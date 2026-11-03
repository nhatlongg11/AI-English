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

## Báo cáo buổi học

Mở **Báo cáo buổi học** trong menu giáo viên hoặc từ trang Điểm danh.

1. Chọn tối đa 10 buổi đã có; có thể chọn tiếp ở trang khác. Báo cáo sắp theo ngày tăng dần, dùng danh sách và điểm danh đã lưu, không tự tạo học sinh hoặc kết quả mẫu.
2. Bấm **Nhập / sửa kết quả** trên từng buổi. Nhập tên lớp trên báo cáo, tổng số từ (1–500), tình trạng bài tập (**Đầy đủ / Một phần / Cần bổ sung / Chưa kiểm tra**), số từ thuộc và điểm mini test (0–10). Tên lớp trên báo cáo không thay hồ sơ học sinh. Điểm danh vẫn chỉnh trong mục Điểm danh.
3. **Lưu kết quả** rồi xem thống kê, bảng tên học sinh, thanh điểm từ vựng và mini test. Cột mini test chỉ xuất hiện khi có ít nhất một điểm. Tên thật được ưu tiên; lớp và ID ngắn giúp phân biệt học sinh trùng tên.
4. Chọn một hoặc nhiều buổi và bấm **In / Lưu PDF**, chọn Save as PDF trong hộp thoại trình duyệt. Bản in ẩn menu và form, dùng màu tím và bảng như mẫu; mỗi buổi sau bắt đầu trên trang mới. Khi có form đang sửa, nút in và đổi lựa chọn bị khóa; Ctrl+P hiển thị lời nhắc lưu, không in báo cáo thiếu phần đang sửa.

Điểm từ vựng = số từ thuộc / tổng số từ × 10. Điểm hiển thị một chữ số thập phân; trung bình tính từ giá trị gốc. **Ô trống không phải 0**, không đưa vào mẫu số trung bình. Điểm 0 đã kiểm tra vẫn được tính. Đi muộn tính có mặt và được đếm riêng; vắng có phép, vắng và chưa điểm danh có thống kê riêng.

Bài tập và điểm kiểm tra trong sổ này do giáo viên ghi nhận, **không suy ra từ lượt đăng nhập hoặc tiến độ bài tập trên app**, không chấm lại bài, không thay mastery và không gọi AI. Vắng không tự xóa điểm đã nhập. Có thể sửa/xóa điểm bằng cách nhập lại hoặc để trống rồi lưu. Hệ thống lưu người và thời gian cập nhật gần nhất, chưa có lịch sử mọi lần sửa. Lưu hoặc hủy trước khi rời trang; điều hướng sang mục khác trong app không tự lưu.

Báo cáo giữ phân quyền của sổ: chủ sổ chỉ xem học sinh còn phụ trách, admin xem đầy đủ; student không truy cập được. Khi đổi tổng số từ, backend kiểm tra cả điểm của học sinh đã chuyển đi để không tạo điểm vượt tổng; nếu xung đột, nhờ admin kiểm tra toàn bộ sổ. Body kiểm tra chặt, update trong một transaction, không nhận người/thời gian cập nhật từ client. Báo cáo có họ tên và điểm cả lớp; chỉ gửi cho người được phép xem, không có liên kết công khai hoặc gửi tự động.

Migration mới `20261103000000_lesson_reports` chỉ thêm cột nullable và trạng thái Chưa kiểm tra mặc định; giữ nguyên điểm danh, tài khoản và lượt làm bài cũ. Khi cập nhật server: sao lưu SQLite, chạy `npm run db:generate`, `npm run db:migrate`, build và khởi động lại. Với Docker Compose hiện có, build lại và chạy init migrations trước API theo hướng dẫn triển khai.

API mới: PATCH `/api/v1/teaching/lessons/:id/report`, teacher chủ sổ/admin, body `{reportClassName: string|null, vocabularyTotal: number|null, records: [{studentId, homeworkStatus, vocabularyKnown: number|null, miniTestScore: number|null}]}`. Từ vựng phải là số nguyên 0–tổng số từ; có điểm thì phải có tổng số từ. `homeworkStatus`: unmarked/complete/partial/missing. GET lesson trả thêm các giá trị và reportedAt/reportedBy. Chỉ ghi các dòng trong body, không thay điểm danh hoặc các dòng còn lại.

## Tạo và giao bài

Mở **Giao bài tập → Tạo bài tập mới**.

1. **Chọn học sinh:** chọn lớp trước, rồi chọn từng em hoặc **Chọn cả lớp**. Có thể tìm tên không dấu và chọn thêm học sinh ở lớp khác; các lựa chọn được giữ. Nếu chưa có học sinh phụ trách, màn hình dẫn thẳng đến mục Học sinh.
2. **Chọn câu hỏi:** mặc định chỉ hiện câu đã duyệt, sắp từ dễ đến khó. Lọc theo thì, dạng bài, độ khó hoặc tìm trong toàn bộ ngân hàng, kể cả các trang sau. Mở đáp án/giải thích khi cần; danh sách Nội dung bài tập cho phép đưa câu lên/xuống hoặc bỏ câu để đổi thứ tự.
3. **Đặt tên bài:** nhập tên bài tập dễ nhận biết và lời dặn nếu cần. Có phần xem trước tên bài như học sinh sẽ nhìn thấy.
4. **Kiểm tra & giao:** xem lại chính xác người nhận, thứ tự và nội dung câu hỏi. **Giao bài ngay** lưu bài và gửi cho học sinh trong cùng luồng thao tác. **Lưu bản nháp** chỉ lưu để hoàn thiện sau, chưa gửi cho học sinh. Có thể quay lại các bước trước mà không mất lựa chọn.

Mỗi bài tối đa 100 câu và 100 học sinh. Chọn cả lớp không âm thầm lấy 100 em đầu nếu lớp vượt giới hạn; hãy chia thành nhóm nhỏ. Câu tự soạn hoặc bật **Hiện cả câu chờ duyệt** vẫn có thể được chọn để chuẩn bị bản nháp, nhưng nút giao bài bị khóa cho tới khi tất cả câu đã được duyệt. Câu bị từ chối cần bỏ khỏi bài.

Trang ban đầu hiển thị bài đã có và nút tạo mới, không mở sẵn cả một form. Bản nháp và bài đã giao có nhãn riêng, ghi rõ học sinh đã nhận bài hay chưa. Sau khi giao, chỉ xem tiến độ; muốn sửa nội dung phải tạo bài mới để giữ nguyên kết quả. Nếu bước gửi bị mất kết nối sau khi đã lưu, thử giao lại dùng đúng bản nháp đó thay vì tạo thêm bài trùng. Đóng/tải lại trình duyệt khi đang sửa chưa lưu sẽ có nhắc nhở; chuyển bước trong form giữ nguyên nội dung.

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
| PATCH `/teaching/lessons/:id/report` | Chủ sổ/admin; tên lớp, tổng từ, homeworkStatus/vocabularyKnown/miniTestScore; kiểm tra điểm và lưu transaction |
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
