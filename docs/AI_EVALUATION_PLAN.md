# Kế hoạch kiểm thử và đánh giá

## Kết quả kiểm tra cục bộ ngày 21/10/2026

- `npm test`: **72/72 tests đạt**, 4 test files, 20.49 giây ở lần chạy cuối; gồm 30 ví dụ ngữ pháp đại diện.
- `npm run check`, `npm run build`: đạt; migration deploy và taxonomy seed thành công trên SQLite thực.
- `npm run demo`: đạt chuỗi generate → review mô phỏng → assignment → grading E01 → mastery → research export, provenance mock và cost 0.
- `npm start`: khởi động HTTP server thành công; health trả 200/ok/explicit_mock; kho câu không token trả 401.
- `npm audit`: 0 vulnerabilities theo registry tại thời điểm kiểm tra.
- `npm run test:live`: **SKIPPED** vì chưa bật opt-in. Không có kết quả xác minh Gemini live; contract SDK, retries, timeout và chi phí chỉ được kiểm tra bằng mocks.

## Kiểm thử phần mềm

`npm run check`, `npm test`, `npm run build`. Vitest dùng database SQLite tạm cho mỗi integration case, áp dụng SQL migration đã lưu và seed taxonomy. Không dùng paid API, không cần key thật. Mock transport kiểm tra cả primary model, chi phí/token, lỗi SDK, timeout/abort, bounded backoff, rate limit, JSON/schema sai, pricing/key thiếu, spending guard và feedback fallback. Các integration tests kiểm tra auth, advanced admin-only, draft/review/reject, duplicate atomicity, answer secrecy, deterministic grading/mapping, mastery, baseline, ownership, persistence qua connection mới, export và deletion cascade.

`src/fixtures.ts` có **30 ví dụ đại diện do tác giả viết**, 10 mỗi tense. Test tên rõ ràng theo nội dung. Đây không phải tập dữ liệu nghiên cứu đã thẩm định. Mock generation có thể chuyển format để demo nhưng không đánh giá được độ khó thực, chủ đề từ vựng hoặc chất lượng Gemini.

`npm run demo` kiểm tra luồng bằng Fastify injection với câu mock và approval mô phỏng trong database tạm. Không thay thế việc giáo viên thật duyệt bank. `npm run test:live` mặc định SKIPPED, chỉ gửi request thật khi `RUN_LIVE_GEMINI=true` và key/pricing hợp lệ; chỉ báo thành công khi response thật qua cả schema/deterministic checks. Không suy diễn kết quả live từ mock tests.

## Đánh giá học liệu bởi giáo viên

Lấy mẫu phân tầng theo 3 tense × 5 độ khó × 3 loại câu. Hai giáo viên độc lập kiểm tra: chính xác ngữ pháp; chỉ một đáp án có cơ sở; từ vựng THCS; ngữ cảnh thời gian rõ; distractor hợp lý; mapping lỗi đúng; giải thích tiếng Việt chính xác. Ghi tỷ lệ chấp nhận, lỗi theo loại và bất đồng; họp xử lý bất đồng trước khi publish. Mục tiêu số lượng/tiêu chí đạt cần xác định trước, không khẳng định đã đạt.

JSON/schema hợp lệ không đo được semantic ambiguity. Deterministic pipeline chỉ bắt lỗi cấu trúc, không thay thế kiểm duyệt. Hiện mọi câu có review flags; approval không xóa dấu vết provenance mock/Gemini.

## Nghiên cứu hiệu quả dự kiến

Xin chấp thuận nghiên cứu và đồng thuận phù hợp trước khi thu thập dữ liệu học sinh. Phân nhóm adaptive/baseline, cân bằng trình độ đầu vào; cùng thời lượng, bank đã duyệt, bài pre/post-test độc lập với bài luyện. Đăng ký trước outcome chính (độ tăng điểm), secondary (độ chính xác theo skill, retention), cỡ mẫu và cách xử lý missing/pending/fallback. Không dùng số lượt làm hoặc mastery nội bộ như bằng chứng duy nhất về học tốt hơn.

Xuất CSV/JSON có anonymousStudentId, mode, group, skill, correctness nullable, errorCode, decision reason, timestamp, algorithm, provenance; không có token, raw answer hoặc diagnosis tự do. answerHash cho phép so sánh trùng nội dung, không phải phương pháp ẩn danh đảm bảo với câu trả lời ngắn (có thể dò). Chỉ chia sẻ tập dữ liệu sau đánh giá tái nhận diện, không tự xem UUID là bảo đảm ẩn danh tuyệt đối. Có thể cần gộp mốc thời gian, nhóm nhỏ và bỏ hashes trước công bố.

## Giới hạn hiện tại

Chưa có hội đồng giáo viên xác nhận ví dụ, kiểm tra bias/vocabulary calibration hay kết quả nghiên cứu. Live API cần key và giá thực; chưa xác minh nếu môi trường không cung cấp. Token staff bootstrap chưa có SSO/session expiry; SQLite/limiter phù hợp prototype một tiến trình. Đáp án free text khác key chờ review, chưa có UI adjudication. Chưa có batch semantic verification bằng model thứ hai hoặc game frontend; không tự tăng chi phí bằng advanced model. Export phân trang tối đa 1000 lượt, cần tải từng trang; dùng snapshot/maintenance window để xuất nhất quán khi nghiên cứu.
