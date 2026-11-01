# Danh mục lỗi ngữ pháp

| Code | Kỹ năng/lỗi | Ví dụ sai → đúng |
|---|---|---|
| E01 | Hòa hợp chủ ngữ – động từ | She walk → She walks |
| E02 | Chọn sai thì | Yesterday he walks → Yesterday he walked |
| E03 | Thiếu trợ động từ | She reading now → She is reading now |
| E04 | Dạng quá khứ | He goed → He went |
| E05 | Cấu trúc câu hỏi | Where he did go? → Where did he go? |
| E06 | Cấu trúc phủ định | She not go → She does not go |
| E07 | Dạng V-ing | runing → running |
| E08 | Dùng trợ động từ | Does they play? → Do they play? |

Mỗi Skill có ID `tense:errorCode`. Bảng taxonomy được seed riêng để bổ sung topic/code sau này; khi mở rộng phải cập nhật enum Zod, prompt, seed, examples và tests. Các tổ hợp được chuẩn bị cho khả năng mở rộng; không có nghĩa mọi code đều áp dụng hợp lý cho mọi tense. Giáo viên phải xem xét scope.

MC: đáp án stored key quyết định đúng/sai, normalized Unicode/case/whitespace. Distractor mapping do generator đề nghị, deterministic checks kiểm tra code hợp lệ và key không có mapping; giáo viên xác nhận ý nghĩa trước approval. Nếu distractor không có mapping, giữ unclassified; không ép về errorCode chính của câu. Lỗi đã xác định được gắn với attempt và skill câu đó; không gọi LLM.

Free text: key khớp chính xác sau normalize được xác nhận đúng; mismatch để `correct:null`, `gradingSource:pending_teacher_review`. Gemini chỉ trả correctedSentence, các mã lỗi có thể có và giải thích Việt. `classified` cần mã và câu sửa; `uncertain`/`unclassified` không có mã; tối đa ba mã khác nhau. Dữ liệu malformed hoặc Gemini lỗi dùng phản hồi uncertain, không làm hỏng submission. Mã AI chỉ nằm trong feedback advisory, không tự thành lỗi xác nhận hoặc hạ mastery. Chưa có UI/quy trình adjudication để xử lý pending review; ưu tiên MC trong thử nghiệm định lượng đầu tiên.

Câu trả lời chỉ nên chứa nội dung bài tập. API chặn URL, email và chuỗi số điện thoại phổ biến, nhưng không thể phát hiện mọi PII trong văn bản. Không gửi thông tin danh tính trong prompts; tên nhân vật trong câu hỏi là tên giả học liệu. Không đưa dữ liệu học sinh thật vào vocabularyTheme hoặc câu trả lời.

Giải thích MC đã duyệt được tái sử dụng trực tiếp từ ngân hàng; feedback của mỗi attempt được lưu và endpoint diagnose trả lại mà không gọi AI thêm. Chỉ generic mock feedback được cache dùng chung; feedback live có thể lặp lại nội dung học sinh nên không được giữ trong shared cache.
