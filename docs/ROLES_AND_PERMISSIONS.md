# Phân quyền giáo viên và quản trị viên

Giáo viên đồng hành với học sinh; quản trị viên chịu trách nhiệm xuất bản học liệu và quản lý toàn hệ thống. Phân quyền được kiểm tra ở API, đồng thời giao diện chỉ hiện thao tác phù hợp.

| Công việc | Giáo viên | Quản trị viên |
| --- | --- | --- |
| Tự soạn, nhập CSV/JSON, tạo bản nháp bằng AI | Có | Có |
| Xem kho câu hỏi và đáp án | Có | Có |
| Duyệt / từ chối bản nháp | Không | Có; không được tự duyệt câu mình tạo |
| Tạo mã đăng nhập cho học sinh | Có; tự động phụ trách học sinh mới | Có; có thể chọn giáo viên phụ trách |
| Xem danh sách, tiến độ và báo cáo | Học sinh mình phụ trách | Tất cả học sinh |
| Giao / chuyển học sinh cho giáo viên | Không | Có, trong mục Học sinh |
| Nghiên cứu & đánh giá toàn hệ thống | Không | Có |
| Chi phí AI và model nâng cao | Không | Có |
| Điểm danh và giao bài tập | Sổ/bài của mình, học sinh mình phụ trách | Toàn hệ thống |

Xem [Điểm danh và giao bài tập](CLASSROOM.md) để biết cách tạo buổi học, soạn/giao bài và xem kết quả.

Học sinh tiếp tục dùng mã riêng để luyện tập và xem kết quả của mình. Giáo viên và admin không dùng endpoint next-question/summary/mastery thay học sinh. Báo cáo giáo viên dùng endpoint riêng được lọc theo quyền.

## Cách sử dụng

1. Đăng nhập bằng mã Teacher hiện có. Trong **Học sinh**, chọn cách giao bài và bấm **Tạo mã cho học sinh**. Sao chép mã ngay để gửi riêng cho em.
2. Học sinh xuất hiện trong danh sách ngay khi tạo, kể cả khi chưa làm bài. **Phân tích học tập** chỉ có kết quả thật của học sinh giáo viên này phụ trách. Nhãn nhóm chỉ giúp lọc báo cáo, không tạo lớp học.
   Phân tích học tập mặc định gồm cả bài tự chọn như Sentence Builder. Nghiên cứu & đánh giá giữ bộ lọc riêng, mặc định không gộp bài tự chọn vào so sánh cách giao bài.
3. Câu tự soạn, nhập từ tệp hoặc gợi ý bằng AI đều vào trạng thái **Chờ duyệt**. Giáo viên có thể mở để xem lại; admin kiểm tra, ghi chú và xác nhận trước khi xuất bản.
4. Admin tạo câu hỏi cũng phải nhờ một admin khác duyệt. Admin có thể từ chối bản nháp của mình. Khi cần thêm admin, cấu hình một tài khoản admin có actorId riêng.
5. Admin chọn **Giáo viên phụ trách** khi tạo mã hoặc tại từng dòng học sinh để phân công lại. Giáo viên nhận quyền xem toàn bộ lịch sử học tập của học sinh hiện được giao cho mình. Chọn **Chưa giao giáo viên** để chỉ admin thấy học sinh đó trong danh sách/báo cáo.

## Hợp đồng và lưu dữ liệu

- `Student.teacherId` là actorId ổn định của giáo viên trong cấu hình staff. Danh sách lựa chọn admin lấy từ `/learning/teachers`; không trả token. Đây chưa phải hệ thống hồ sơ nhân sự hay lớp học.
- `GET /learning/students` trả danh sách phân trang kèm số lượt làm và số câu đã chấm/đúng, không có mã đăng nhập/hash. `GET /learning/reports` trả CSV/JSON theo cùng phạm vi quyền. Cả hai lọc theo teacherId trong database trước khi phân trang. `/research/export` vẫn chỉ dành cho admin.
- Teacher không thể tự chỉ định giáo viên khác/null khi tạo học sinh, hoặc gọi API phân công. Admin chỉ được gán teacherId có trong cấu hình.
- API duyệt/từ chối chỉ cho admin. Duyệt câu có `createdBy` trùng actorId người gọi trả `403 SELF_REVIEW_FORBIDDEN`. Nguồn thủ công, nhập tệp và AI mới đều lưu người tạo từ phiên xác thực, không nhận metadata này từ client.
- Migration `20261022010000_student_teacher` thêm cột nullable và index, giữ nguyên token và lịch sử. Học sinh cũ chưa được giao chỉ admin thấy. Các câu cũ có createdBy=null giữ nguyên trạng thái; hệ thống không đoán tác giả hay gỡ câu đã dùng. Admin cần xác minh nguồn khi duyệt bản nháp cũ không có tác giả.
- `npm run db:seed:accounts` dùng lại mã hiện có và giao hai học sinh đã seed cho Teacher đã seed nếu các em chưa có giáo viên. Không ghi đè phân công đang có, không tạo lượt luyện giả, không sửa cấu hình Gemini.

Máy local đã chạy migration, generate Prisma client và cập nhật hai học sinh seed. Với bản cài đặt khác, chạy `npm run db:migrate`, `npm run db:generate`, rồi khởi động lại backend. Có thể chạy lại seed accounts nếu dùng các tài khoản thử có sẵn.

## Xác minh ngày 22/10/2026

- **95 backend tests** và **33 frontend tests** đã qua. Có kiểm tra teacher/admin/student, chặn tự duyệt cả câu thủ công/nhập/AI, giả metadata, hai giáo viên độc lập, phân trang, CSV, học sinh chưa làm bài, phân công và dữ liệu cũ chưa giao.
- Type checks, backend/frontend builds và kiểm tra credential không nằm trong client bundle đều qua.
- Giao diện được kiểm tra bằng component thật: teacher có nút tạo mã và báo cáo, không có nút duyệt/từ chối; admin không thể duyệt câu mình tạo; có lựa chọn giáo viên khi tạo mã.
- `npm run test:live:roles` đã qua qua **Vite → Fastify → SQLite hiện tại**, trong chế độ Gemini thật: teacher bị từ chối duyệt/từ chối câu, không đọc được research toàn hệ thống; admin vào được bước attestation; teacher tạo learner, learner trả lời đúng câu Gemini đã được duyệt, tiến độ/báo cáo phản ánh đúng một lượt làm. Sau khi admin bỏ phân công, teacher không còn thấy learner và kết quả đó.
- Không gọi Gemini mới; giữ nguyên câu hỏi đã có. Learner QA dùng để kiểm tra và lịch sử của nó đã được xóa; tiến độ của các tài khoản seed giữ nguyên. Bằng chứng không chứa credential nằm ở file local được ignore `.tmp/role-verification.json`.
- Browser automation đang bị policy chặn nên lần cập nhật này không có kiểm tra click-through hay ảnh chụp trình duyệt mới. Xác minh giao diện dùng DOM; xác minh tích hợp dùng HTTP/database thật.

Xem [API](API_REFERENCE.md) và [câu hỏi của thầy cô](QUESTION_AUTHORING.md).
