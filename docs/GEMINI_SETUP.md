# Cấu hình Gemini và độ tin cậy

## Cài đặt tái lập

Từ thư mục gốc với Node 22.12+ và npm: `npm ci`, `npm run setup:local -- --mock`, `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`. Prisma 7 dùng adapter `@prisma/adapter-better-sqlite3`; URL SQLite tương đối được giải từ thư mục gốc ở cả CLI/runtime. Migrations đã commit; không cần `db push`. Khi sửa schema, chạy `npx prisma migrate dev --name ten_thay_doi` và `npm run db:generate`.

`setup:local` tạo token ngẫu nhiên vào `.env`; không ghi đè file đã có. Cũng có thể copy `.env.example` thành `.env`, tự thay hai token bằng chuỗi ngẫu nhiên dài tối thiểu 32 ký tự. Không dùng token ví dụ khi triển khai. `.env` và database được ignore.

## Gemini thật

Lấy key từ Google AI Studio, giữ ở máy chủ. Đặt các biến:

| Biến | Ý nghĩa |
|---|---|
| `AI_PROVIDER=gemini` | Chỉ provider chính thức này được hỗ trợ |
| `AI_MOCK_MODE=false` | Không dùng mock/fallback giả làm Gemini |
| `GEMINI_API_KEY` | Khóa bí mật phía server |
| `GEMINI_PRIMARY_MODEL=gemini-3.5-flash-lite` | Mặc định tiết kiệm |
| `GEMINI_ADVANCED_MODEL=gemini-3.8-flash` | Chỉ admin chọn explicit advanced |
| `AI_MAX_QUESTIONS_PER_REQUEST=10` | Tối đa 1–10 câu/batch |
| `AI_DAILY_BUDGET_USD=1` | Hạn mức dự toán trong ngày UTC |
| `AI_PRIMARY_INPUT_USD_PER_MILLION` / `AI_PRIMARY_OUTPUT_USD_PER_MILLION` | Giá hiện hành, USD/triệu token, phải dương khi dùng live |
| `AI_ADVANCED_INPUT_USD_PER_MILLION` / `AI_ADVANCED_OUTPUT_USD_PER_MILLION` | Giá riêng model nâng cao |
| `AI_TIMEOUT_MS=20000` | Timeout mỗi lần gọi |
| `AI_MAX_RETRIES=2` | Số lần thử lại, tối đa 3 |
| `AI_MAX_OUTPUT_TOKENS=8192` | Trần output, tối đa 16384 |
| `AI_RATE_LIMIT_PER_MINUTE=10` | Hạn mức endpoint AI/submission theo IP |

Không đóng đinh giá như hằng số vĩnh viễn. Đối chiếu [bảng giá Google](https://ai.google.dev/gemini-api/docs/pricing) trước khi điền. Giá phải bao gồm cách tính reasoning/output của model; không cấu hình 0 cho live để vô hiệu guard. Mock không cần key/giá, luôn có `provenance: mock`, model mock và chi phí 0. Mock dùng 30 ví dụ hữu hạn, không đảm bảo hiệu chỉnh độ khó/chủ đề; yêu cầu vượt số ví dụ cho scope nhận 422.

SDK đã khóa trong lockfile. Dùng `client.interactions.create`, `response_format: {type:'text', mime_type:'application/json', schema}`, `generation_config.max_output_tokens`, `store:false`; parse JSON rồi Zod. Nguồn đã đối chiếu: [Getting started](https://ai.google.dev/gemini-api/docs/get-started), [Structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Models](https://ai.google.dev/gemini-api/docs/models). Tính sẵn có theo tài khoản/vùng phải kiểm tra bằng live smoke; việc model được liệt kê không chứng minh key của bạn có quyền.

## Chi phí và lỗi

Trước mỗi lần gọi, transaction SQLite cộng chi phí đã dùng và đặt reservation. Input reserve dùng số byte UTF-8 của prompt + schema + 4096 overhead; output reserve dùng trần output. Giá/cost/model/status được lưu cho từng lần gọi, kể cả retries. Sau phản hồi có token metadata, cập nhật `(input × giá input + output × giá output) / 1e6`; output dùng toàn bộ token không phải input nếu có total, để tính bảo thủ cả reasoning. Thiếu usage hoặc timeout/lỗi, giữ toàn bộ reservation và đánh dấu estimated. Reservation từ process bị dừng giữ nguyên, tránh chi lại ngân sách không rõ. Kiểm tra thủ công với billing trước khi điều chỉnh dữ liệu.

Đây là **guard theo dự toán của ứng dụng**, không phải giới hạn billing cứng của Google. Chi phí thực còn phụ thuộc token hóa, cache và điều khoản giá; mọi tiến trình phải dùng cùng database để dùng chung guard. Cấu hình quota/budget phía Google khi triển khai. Giữ single backend process cho SQLite prototype và limiter in-memory; nhiều replicas cần shared DB/limiter.

Chỉ retry 408, 429, 500, 502, 503, 504, lỗi mạng TypeError và timeout; chờ 250ms, 500ms, 1000ms (bounded). SDK retry bị tắt để tránh retry kép. Không retry JSON/schema sai hoặc lỗi xác thực. Không chuyển model. AbortSignal và deadline giới hạn mỗi lần gọi. Trả mã lỗi an toàn; fallback diagnosis là uncertain, không sinh mock âm thầm. Kho đã duyệt vẫn hoạt động nếu Gemini lỗi.

## Kiểm tra live opt-in

Sau migrations, key và giá hợp lệ, đặt `RUN_LIVE_GEMINI=true`, chạy `npm run test:live`. Script sinh một câu primary, kiểm tra schema + deterministic checks, ghi usage; không publish và không lưu câu vào bank. Chỉ in `LIVE_VERIFIED` khi thực sự thành công. Nếu không opt-in thì SKIPPED. Bộ test thường không dùng API key hoặc credits.
