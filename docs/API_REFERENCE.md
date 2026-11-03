# API v1

Kế hoạch học cá nhân, giải thích đã nộp, giáo án và gợi ý giảng dạy: xem [AI_SUPPORT](AI_SUPPORT.md#api).

API điểm danh, báo cáo buổi học (bài tập về nhà, từ vựng, mini test), tên học sinh và bài tập được giao: xem [CLASSROOM](CLASSROOM.md#api).

Base URL local: `http://127.0.0.1:3000/api/v1`. Body JSON, tối đa 16 KiB; hai endpoint import cho phép tối đa 512 KiB và 50 câu. Ngoại trừ health, dùng `Authorization: Bearer <token>`. Bộ yêu cầu đầy đủ tại `api/tenselab.http` (REST Client/JetBrains).

## Endpoints và quyền

| Method + path | Quyền | Mục đích |
|---|---|---|
| GET `/health` | Công khai | Database health, mode mock/Gemini |
| GET `/auth/session` | Token hợp lệ | Vai trò và định danh phiên, không có credential |
| POST `/questions` | Teacher/admin | Tạo câu tự soạn, luôn là draft; không gọi AI |
| POST `/questions/import/preview` | Teacher/admin | Kiểm tra từng câu, câu trùng, không ghi database |
| POST `/questions/import` | Teacher/admin | Nhập tối đa 50 câu theo transaction; tùy chọn bỏ qua câu trùng |
| POST `/ai/questions/generate` | Teacher/admin | Sinh batch draft; advanced chỉ admin |
| GET `/ai/questions` | Teacher/admin | Kho có key, filter status/tense, limit ≤100, offset |
| POST `/ai/questions/:id/approve` | Admin khác người tạo | Duyệt draft đã kiểm tra |
| POST `/ai/questions/:id/reject` | Admin | Từ chối draft |
| GET `/ai/content-needs` | Teacher/admin | Tối đa 100 yêu cầu thiếu học liệu, không có student ID |
| POST `/learning/students` | Teacher/admin | Tạo mã; teacher tự động phụ trách học sinh mới |
| GET `/learning/students` | Teacher/admin | Danh sách phân trang, cả học sinh chưa làm bài; teacher chỉ thấy học sinh mình phụ trách |
| GET `/learning/teachers` | Admin | Định danh giáo viên có thể nhận học sinh, không credential |
| PATCH `/learning/students/:id/teacher` | Admin | Giao/chuyển học sinh bằng `{teacherId}`; null để bỏ phân công |
| GET `/learning/reports` | Teacher/admin | Báo cáo CSV/JSON; teacher chỉ thấy học sinh mình phụ trách |
| GET `/learning/students/:id/next-question` | Chính student | Câu đã duyệt + decisionId + reason + generationNeeded |
| POST `/learning/attempts` | Student | Nộp assignment của chính mình |
| GET `/learning/students/:id/mastery` | Chính student | Điểm kỹ năng đã lưu |
| GET `/learning/students/:id/summary` | Chính student | Counters toàn bộ, XP, 100 activity gần nhất, mastery và availability |
| GET `/learning/assignments/:id/result` | Chính student | Khôi phục kết quả đã nộp theo decision ID khi mất response |
| POST `/ai/diagnose` | Student | Lấy feedback cho attempt đã nộp của chính mình |
| GET `/ai/usage` | Admin | Token/chi phí ngày UTC và 100 lần gọi mới nhất |
| GET `/research/export` | Admin | CSV/JSON phân trang |
| DELETE `/learning/students/:id` | Chính student/admin | Xóa credential, attempts, decisions và mastery |

Teacher chỉ xem danh sách/báo cáo học sinh có `teacherId` trùng actorId của mình; không được xem báo cáo nghiên cứu toàn hệ thống. Admin xem toàn hệ thống và phân công giáo viên. Các endpoint mastery/summary/next vẫn dành riêng cho chính student. Token học sinh được trả **một lần** lúc tạo; DB chỉ lưu SHA-256. Cất token ở session bảo mật phía server khi tích hợp game. Header staff chỉ dùng trong công cụ quản trị, không đặt ở game client.

Frontend nhận session qua token hiện có, không dùng Gemini key. Next-question nhận thêm filter optional `tense`/`questionType` cho bài luyện tự chọn; quyết định có scope được ghi `practiceContext:student_selected_practice`. Với câu error_correction, `wordTokens` chứa ID opaque ổn định và các từ đã xáo trộn. Sentence Builder nộp `tokenIds` thay `answer`; server kiểm tra đầy đủ, không trùng/không lạ, dựng câu và chấm bằng key hiện có. Xem [hợp đồng frontend](FRONTEND_IMPLEMENTATION.md) để biết chi tiết và giới hạn nghiên cứu.

## Sinh và duyệt

### Câu hỏi do giáo viên cung cấp

`POST /questions` nhận một object theo question schema: `tense`, `difficulty`, `questionType`, `content`, `options: [{text,errorCode}]`, `correctAnswer`, `explanationVi`, `grammarRule`, `errorCode`. Không nhận status/provenance/model/createdBy từ client. Trả HTTP 201 `{question}` với `status: draft`, `provenance: teacher_manual`, `model: human`, `createdBy` lấy từ phiên xác thực. Không gọi Gemini và không tạo AiUsage.

Hai endpoint import nhận `{questions: [...], skipDuplicates: true}`. Preview trả `{rows: [{row, content, valid, duplicate, errors}], invalidCount, duplicateCount, readyCount}`; row đánh số câu từ 1, không phải số dòng vật lý CSV. `duplicate` là `bank`, `file` hoặc null. Preview không ghi dữ liệu. Commit kiểm tra lại trong transaction, trả HTTP 201 `{questions, skipped}` với `provenance: teacher_import`. Một câu không hợp lệ làm cả lượt bị hủy (400); `skipDuplicates: false` và có câu trùng trả 409. Bỏ qua câu trùng là tùy chọn rõ ràng, không bỏ qua câu lỗi. Nhập lại cùng tệp với skip=true không thêm bản sao.

Mọi dạng câu dùng cùng kiểm tra schema/đáp án như câu AI: 3–5 đáp án trắc nghiệm khác nhau, key khớp một lựa chọn, tiếng Việt trong giải thích; câu điền từ cần một `____` và cue `____ (walk)`. Câu mới vẫn phải qua endpoint approve với attestation. Server lưu người tạo và nguồn; public student DTO không chứa người tạo hay đáp án. Xem [hướng dẫn CSV/JSON](QUESTION_AUTHORING.md).

### Câu hỏi gợi ý bằng AI

```json
{"tense":"present_simple","difficulty":1,"questionType":"multiple_choice","count":3,"targetErrorCode":"E01","vocabularyTheme":"school","modelTier":"primary"}
```

tense: `present_simple|present_continuous|past_simple`; difficulty integer 1..5; questionType: `multiple_choice|fill_in_blank|error_correction`; count 1..configured max (≤10); targetErrorCode E01..E08 và vocabularyTheme ≤80 ký tự là optional; modelTier mặc định primary. Theme chỉ là mô tả từ vựng, không chứa instructions hoặc thông tin học sinh.

Response `{questions:[...]}` có id, skillId, tense, difficulty, questionType, content, options `{text,errorCode}`, correctAnswer, explanationVi, grammarRule, errorCode, provenance, model, promptVersion, generatedAt, validationStatus, reviewFlags (JSON string), status, review metadata. Tất cả mới tạo có status draft. Mock không bị đổi nhãn sau approval.

Chỉ admin được duyệt/từ chối. Người tạo không được tự duyệt, kể cả admin (`403 SELF_REVIEW_FORBIDDEN`). Câu AI mới cũng lưu createdBy từ phiên. Duyệt body: `{"note":"Đã kiểm tra ngữ pháp và đáp án duy nhất.","checkedGrammarAndAnswer":true}`. Reject chỉ cần `note` 5..500 ký tự. Có conflict 409 khi đã duyệt/từ chối hoặc batch trùng nội dung. Revision hiện tại tạo câu mới, chưa có endpoint sửa in-place để tránh thay key sau khi có attempt.

## Vòng học

Teacher hoặc admin tạo student bằng `{"mode":"adaptive","experimentGroup":"A"}` hoặc mode baseline/group B. Response 201 chứa id, token, mode, experimentGroup và teacherId. Teacher tự động được gán phụ trách; admin có thể truyền teacherId của giáo viên trong cấu hình hoặc bỏ trống (chưa giao). Student gọi next-question với token của mình; response có decisionId, question (options là chuỗi, không có key/giải thích/mapping), reason và generationNeeded. Kho trống: question null. Fallback luôn dùng bank approved.

Submit: `{"decisionId":"UUID-đã-nhận","answer":"walks"}`. MC gửi text của option, không dùng chữ A/B. Đúng/sai theo key, không gọi Gemini; kết quả chứa attemptId, correct, correctAnswer, explanationVi, diagnosis, gradingSource và mastery. Assignment chỉ nộp một lần; nộp lại 409. Body không nhận studentId/mode do client chỉ định.

Fill-in gửi phần còn thiếu; error-correction gửi câu hoàn chỉnh đã sửa, không kèm lời giải. Chỉ normalize Unicode/case/whitespace. Khớp key xác nhận đúng; mismatch có correct null và requiresTeacherReview true, AI advisory diagnosis nếu khả dụng. Không coi một cách diễn đạt khác là sai chắc chắn. Không đưa pending vào mastery. Gemini chỉ nhận question context + answer, không student ID/group/token. `/ai/diagnose` body `{"attemptId":"UUID"}` trả feedback đã lưu, không gọi Gemini lần nữa và không mở đáp án chưa nộp.

## Lỗi, hạn mức, export

Response lỗi `{error:"CODE",message:"safe message"}`; validation có issues path/message, không echo raw input. 400 shape/scope/option sai; 401 token thiếu/sai; 403 quyền; 404 ID không có/không thuộc người gọi; 409 duplicate/review/submission conflict; 413 body quá lớn; 422 mock insufficient; 429 limiter/provider-rate/budget; 502 structured response invalid; 503 key/pricing/provider; 504 timeout. Các thông báo SDK nguyên văn bị chặn.

Rate limit theo IP: 120 requests/phút chung; các routes AI và attempts có max riêng `AI_RATE_LIMIT_PER_MINUTE`. Endpoint diagnose chỉ đọc feedback nhưng vẫn được giới hạn. Trong lớp học chung NAT, điều chỉnh hạn mức hoặc triển khai limiter xác thực dùng chung phù hợp.

Export query `format=json|csv&limit=1000&offset=0`. JSON có rows và nextOffset; CSV có header và bảo vệ formula injection. Không xuất raw answer, diagnosis, credential hay tên/email. Answer hash không thay thế rà soát bảo mật dữ liệu khi công bố. UUID vẫn liên kết được nhiều lượt cùng người. Xóa học sinh trả 204 và xóa cascade trong DB; backup hoặc bản export ngoài hệ thống phải được xử lý theo chính sách lưu trữ riêng. Shared live diagnosis cache không lưu văn bản người học; usage không chứa ID học sinh.

Danh sách học sinh nhận `limit` ≤100 và `offset`, trả `{students, nextOffset}`. Mỗi học sinh có id/mode/experimentGroup/teacherId/createdAt và total/confirmed/correct; không trả token hay hash. `/learning/reports` dùng cùng query/phân trang/DTO với `/research/export`, nhưng lọc quyền trong SQL trước khi phân trang. Xem [phân quyền](ROLES_AND_PERMISSIONS.md).
