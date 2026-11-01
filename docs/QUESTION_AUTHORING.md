# Câu hỏi của thầy cô

Mở **Ngân hàng câu hỏi** bằng tài khoản giáo viên hoặc quản trị viên. Ba cách thêm bài nằm ngay đầu trang: **Tự soạn câu hỏi**, **Nhập từ tệp**, **Tạo với AI**. Hai cách đầu không gọi Gemini.

## Tự soạn một câu

Chọn thì ngữ pháp, dạng bài, độ khó và điểm ngữ pháp cần luyện; nhập đề bài, đáp án, giải thích tiếng Việt và quy tắc. Với trắc nghiệm, chọn nút tròn cạnh đáp án đúng và dùng 3–5 lựa chọn khác nhau. Với điền từ, dùng đúng một chỗ trống và động từ gợi ý ngay sau nó, ví dụ `She ____ (walk) to school every day.` Đáp án chỉ là phần còn thiếu. Với sửa lỗi, nhập cả câu đã sửa đúng làm đáp án; trò xếp từ cũng dùng câu này.

Bấm **Lưu bản nháp**. Câu được kiểm tra trước khi ghi; nếu cần sửa, nội dung vẫn còn trong form. Sau khi lưu, màn hình chi tiết mở để thầy cô đọc lại. Câu tự động vào hàng chờ quản trị viên duyệt trước khi giao cho học sinh.

## Nhập nhiều câu từ Excel hoặc JSON

1. Bấm **Nhập từ tệp**, tải **Mẫu CSV** hoặc **Mẫu JSON**.
2. Trong Excel, giữ tên cột, điền nội dung của mình và lưu dưới dạng **CSV UTF-8**. Có thể để trống đáp án D/E nếu chỉ dùng 3 lựa chọn. Không để các cột đáp án A–E có nội dung cho bài điền từ/sửa lỗi.
3. Chọn tệp để xem trước. Mỗi lần tối đa **50 câu / 256 KB** trên giao diện. CSV hỗ trợ BOM, dấu phẩy hoặc chấm phẩy, ô có xuống dòng, dấu phẩy và dấu ngoặc kép đúng cách. JSON nhận array câu hỏi hoặc `{questions: [...]}` theo mẫu.
4. Xem số câu sẵn sàng, câu trùng và câu cần sửa. Câu trùng được nhận diện cả trong kho lẫn trong tệp bằng nội dung chuẩn hóa chữ hoa/thường, Unicode và khoảng trắng. Có thể bật/tắt bỏ qua câu trùng.
5. Nếu có lỗi, sửa trong tệp rồi chọn lại. Khi tất cả câu hợp lệ, bấm **Nhập … câu vào kho**. Cả lượt được kiểm tra lại và lưu trong một transaction; không lưu một phần nếu có câu lỗi.

Tệp CSV dùng tiêu đề tiếng Việt. Chủ đề chấp nhận tên thì tiếng Việt, tiếng Anh hoặc mã trong JSON. Dạng bài nhận nhãn trong mẫu hoặc mã `multiple_choice`, `fill_in_blank`, `error_correction`. Với trắc nghiệm, cột **Đáp án đúng** nhận A–E hoặc nguyên văn lựa chọn. Kỹ năng nhận nhãn tiếng Việt trong mẫu hoặc mã E01–E08. Lựa chọn CSV chưa có mã lỗi riêng sẽ để mapping null, tránh đoán lỗi cho học sinh.

Mẫu cũng được lưu tại [CSV](templates/tenselab-questions.csv) và [JSON](templates/tenselab-questions.json). Đây là ba ví dụ do người viết cung cấp để hướng dẫn cấu trúc, không phải dữ liệu học sinh hoặc câu do Gemini tạo.

## Nguồn và quyền

Câu tự soạn hiện nhãn **Tự soạn** (`teacher_manual`); câu nhập hiện **Nhập từ tệp** (`teacher_import`). Server ghi `createdBy` từ tài khoản đã xác thực; không nhận nguồn/người tạo/trạng thái xuất bản do tệp chỉ định. Tất cả bắt đầu ở draft; chỉ quản trị viên được duyệt/từ chối. Người tạo, kể cả admin, cần một quản trị viên khác duyệt. Học sinh không có quyền thêm hoặc nhập câu và không nhận đáp án/người tạo trong assignment chưa nộp. Đã duyệt thì nguồn vẫn được giữ nguyên, không đổi thành Gemini.

Migration `20261022000000_question_author` thêm cột `Question.createdBy` nullable, giữ nguyên các câu và lượt làm cũ. Khi cập nhật một bản cài đặt khác, chạy `npm run db:migrate`, `npm run db:generate` và khởi động lại backend. Migration và client đã được cập nhật trên máy local hiện tại.

## Kiểm tra

Backend tests bao phủ quyền, metadata giả, schema/key/cue, preview không ghi, rollback cả batch, câu trùng và nhập lặp, tác giả và publication gate. Frontend tests bao phủ CSV/JSON, Unicode/quotes/newline, file lỗi, form chọn đáp án, preview trước commit, lỗi dòng và chuyển từ bank → soạn → kiểm duyệt.

Luồng qua **ApiClient thật → Vite → Fastify → SQLite hiện tại** đã lưu một câu tự soạn và hai câu nhập từ mẫu, kiểm tra metadata, duplicate replay, rollback, student 403 và kho draft. **0 lần gọi AI, 0 lượt học sinh mới**. Ba ví dụ vẫn là draft để giáo viên xem và quản trị viên duyệt. Chi tiết ID nằm trong `.tmp/authoring-verification.json`. Browser automation vẫn bị policy chặn nên không có screenshot hay xác nhận click-through trực quan mới; kiểm tra DOM dùng component thật và kiểm tra HTTP/database đã hoàn tất.
