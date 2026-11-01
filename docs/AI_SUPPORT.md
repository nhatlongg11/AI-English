# Công cụ AI cho việc học và giảng dạy

## Học sinh

**Cố vấn AI** trong menu hoặc **Lập kế hoạch cùng AI** trên trang chủ mở `/student/ai-coach`. Chọn 3 hoặc 7 ngày, 5–30 phút/ngày rồi bấm **Tạo kế hoạch với AI**. AI gợi ý mục tiêu và hoạt động từng ngày, kèm đường dẫn bài học và bài luyện đã có trong kho. Chủ đề chưa có câu đã duyệt chỉ hiện đường dẫn bài học và thông báo đang bổ sung bài luyện.

Kế hoạch dùng tối đa 500 lượt gần nhất của chính học sinh. Số lượt, đúng/chờ kiểm tra và phần tóm tắt dữ liệu được **server tính từ database**, không lấy số do AI đoán. Chưa có câu đã chấm thì hiện rõ đây là kế hoạch làm quen; không đánh giá sức học từ dữ liệu trống. Câu chờ kiểm tra không tính sai. Thống kê thể hiện thời điểm tạo; muốn dùng kết quả học mới, bấm tạo lại.

Sau khi nộp câu trong luyện tập hoặc bài thầy cô giao, bấm **Nhờ AI giải thích dễ hiểu hơn** để xem quy tắc, các bước suy luận và một ví dụ mới có nghĩa tiếng Việt. Chỉ giải thích câu đã nộp của chính người học, không lấy đáp án cho câu chưa làm. Có thể xem lại 5 câu gần nhất và hỏi AI trong **Tiến bộ của bạn → Xem lại và hỏi AI**. Giải thích không đổi đúng/sai, XP hoặc điểm thành thạo.

## Giáo viên và admin

**Trợ lý giảng dạy AI** ở menu hoặc Tổng quan mở `/teacher/ai-tools`, gồm hai phần:

- **Soạn giáo án cùng AI:** chọn thì, mức 1–5, thời lượng 30/45/60 phút và điểm ngữ pháp cần tập trung. Giáo án có mục tiêu, hoạt động theo thời gian, hỗ trợ, mở rộng và cách củng cố. Server kiểm tra tổng phút khớp thời lượng yêu cầu. Bấm **Soạn câu hỏi theo giáo án** để mở AI Studio đã chọn đúng thì/độ khó/mã lỗi, rồi chủ động tạo bản nháp.
- **Buổi tới nên ôn gì?:** AI gợi ý từ thống kê kết quả học sinh giáo viên đang phụ trách; admin dùng thống kê toàn hệ thống. Không có câu đã chấm thì không gọi model và không bịa nhận xét. Cấu trúc response được giới hạn vào thì đã có câu đã chấm và các mã lỗi thực sự xuất hiện; không có lỗi thì errorCode bắt buộc null. Các gợi ý có đường dẫn **Soạn câu ôn tập** mở AI Studio đúng chủ đề/mã lỗi.

Nhận xét hỗ trợ việc chuẩn bị bài, không phải kết luận về hiệu quả dạy học, nguyên nhân hay mức tăng tiến bộ. Nội dung mới không tự vào kho, không được tự duyệt hoặc giao bài. Quy trình admin duyệt câu hỏi và chặn người tạo tự duyệt vẫn giữ nguyên.

## Dữ liệu và cách gọi AI

- Model là Gemini primary hiện được cấu hình, dùng chung AiService: structured JSON, timeout, retry có giới hạn, rate limit, dự trù ngân sách và ghi usage/token/cost. Không đổi key, giá hoặc ngân sách để kiểm tra.
- Mở trang chỉ đọc kết quả đã lưu, không tự gọi Gemini. Tạo mới/giải thích chỉ chạy khi bấm nút.
- Kết quả có provenance, model, thời gian và cache flag; mock được gắn nhãn **Nội dung mẫu mô phỏng**. Không giả mock thành Gemini khi provider lỗi.
- Cache 24 giờ theo tài khoản, vai trò, loại tính năng, model, phiên bản prompt và dữ liệu đầu vào. Cùng yêu cầu đang chạy dùng chung một lời gọi trong một server process. Kết quả học thay đổi làm key kế hoạch/nhận xét thay đổi. Lịch sử giữ tối đa 5 kết quả để hiển thị; kết quả cũ vẫn có thời điểm tạo và thống kê tại lúc tạo.
- Kế hoạch/giải thích cá nhân gắn với student và bị xóa cascade khi xóa học sinh. Kết quả staff tách theo cả role và actorId. Không đọc lịch sử của người khác, kể cả cấu hình hai role dùng chung actorId.
- Không đưa tên học sinh, lớp, mã/UUID, nhãn nhóm, token hoặc câu trả lời nguyên văn vào prompt. Kế hoạch/nhận xét chỉ gửi số đếm tổng hợp. Giải thích chỉ gửi câu hỏi, key đã duyệt, quy tắc, giải thích gốc và kết quả/mã lỗi của câu đã nộp; không gửi raw answer của người học.
- Ví dụ và hoạt động do AI gợi ý vẫn cần người dùng kiểm tra. Server kiểm tra cấu trúc và các ràng buộc đếm/thời gian/mã lỗi, không chứng nhận mọi câu văn AI là đúng về ngữ pháp.

Migration `20261028020000_ai_learning_support` thêm AiSupportCache, không sửa dữ liệu lớp học, câu hỏi, điểm hay credential cũ. Máy local đã migrate và generate client. Với bản cài đặt khác chạy `npm run db:migrate`, `npm run db:generate`, rồi khởi động lại backend.

## API

Prefix `/api/v1`, Bearer token. Các POST nhận JSON strict và hạn mức AI hiện có. Model tier không do client chọn ở các công cụ này.

| Endpoint | Quyền / body |
| --- | --- |
| POST `/ai/study-plan` | Student; `{days:3 hoặc 7,minutesPerDay:5..30}`; không nhận progress do client tự khai |
| POST `/ai/answer-explanation` | Student; `{attemptId}` của chính mình, sau khi đã nộp |
| POST `/ai/lesson-plan` | Teacher/admin; `{tense,difficulty:1..5,minutes:30 hoặc 45 hoặc 60,focusError:E01..E08 hoặc null}` |
| POST `/ai/class-insights` | Teacher/admin; `{}`, thống kê do server tự lấy theo quyền |
| GET `/ai/support/history?kind=...` | study_plan/answer_explanation cho student; lesson_plan/class_insights cho staff; chỉ dữ liệu của người gọi |

Response có `{data,context,model,provenance,createdAt,cached}`. Lỗi 422 INSUFFICIENT_LEARNING_DATA khi chưa có câu đã chấm để nhận xét; 502 INVALID_AI_OUTPUT khi nội dung không đúng cấu trúc/ngày/thời lượng/mã lỗi; các lỗi budget/provider tiếp tục dùng mã hiện có. Không báo tạo thành công và không ghi cache khi AI thất bại.

## Xác minh

Ngày 28/10/2026: **114 backend tests + 49 frontend tests đều qua**, cùng type checks, production builds và kiểm tra credential không nằm trong client bundle.

Tests bao phủ dữ liệu thật từ SQLite test, phân quyền, không lộ key chưa nộp, giữ điểm, pending, tách giáo viên/admin, history, cache/coalescing/expiry, privacy prompt, sai day sequence/duration/error, không tốn phí khi chưa đủ dữ liệu và lỗi Gemini/ngân sách. Frontend kiểm tra tạo theo yêu cầu, xem lại cache, trạng thái lỗi, liên kết tới bài luyện/AI Studio và không tự xuất bản. ApiClient được kiểm tra với Fastify và SQLite.

`npm run test:live:ai-support` (cần `RUN_LIVE_GEMINI=true`) đã kiểm tra cả bốn công cụ qua Vite → Fastify → **Gemini thật**, dùng 5 lượt học đã lưu. Đã đối chiếu số lượt học, phạm vi giáo viên, tổng phút, câu đã nộp và cache; không đổi điểm hoặc kho câu hỏi. Kết quả thật được giữ để người dùng xem ngay trên app. Báo cáo local không có credential: `.tmp/ai-support-verification.json`. UI được kiểm tra qua DOM, chưa có click-through trình duyệt trực quan mới.
