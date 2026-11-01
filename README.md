# TenseLab AI Core

**Docker deployment:** run `docker compose up -d --build` with your configured `.env`.
The frontend is available at `http://127.0.0.1:8080`; SQLite data persists in a named
volume. See [deployment, database import, and backups](docs/DEPLOYMENT.md).

**AI hỗ trợ học và dạy:** Kế hoạch ôn tập cá nhân, giải thích sau khi nộp câu, giáo án theo thời lượng và gợi ý ôn tập từ kết quả học sinh. Dùng Gemini thật, cache, phân quyền và ngân sách hiện có; không tự duyệt câu hoặc đổi điểm. Xem [cách dùng và API](docs/AI_SUPPORT.md).

**Điểm danh & giao bài:** Giáo viên có sổ điểm danh từng buổi, tự soạn/chọn câu để tạo bài và giao cho học sinh. Học sinh mở **Bài thầy cô giao** để làm và lưu tiến độ. Câu hỏi vẫn cần admin duyệt. Xem [cách dùng và API](docs/CLASSROOM.md).

**Frontend đã có:** React/Vite + shadcn/ui, ba trò luyện ngữ pháp, AI Studio, duyệt học liệu và research dashboard. Chạy `npm run dev` để mở cả backend và frontend, rồi vào `http://127.0.0.1:5173`. Lệnh này tái sử dụng dịch vụ đang chạy. Dùng token hiện có để xem dữ liệu thật. Xem [hướng dẫn frontend](docs/FRONTEND_IMPLEMENTATION.md) và [kết quả kiểm tra Gemini thật](docs/LIVE_VERIFICATION.md).

**Phân quyền:** Giáo viên tạo mã và xem báo cáo cho học sinh mình phụ trách; admin phân công học sinh, duyệt học liệu và xem báo cáo toàn hệ thống. Người tạo không được tự duyệt câu hỏi. Xem [chi tiết](docs/ROLES_AND_PERMISSIONS.md).

**Bài của thầy cô:** Ngân hàng câu hỏi hỗ trợ tự soạn và nhập CSV/JSON, tải mẫu, xem trước, kiểm tra lỗi và bỏ qua câu trùng. Mọi câu mới được lưu nháp để duyệt; không cần Gemini. Xem [hướng dẫn](docs/QUESTION_AUTHORING.md).

Backend TypeScript độc lập cho nền tảng học thì tiếng Anh THCS. Fastify 5, Zod 4, Prisma 7 + SQLite, SDK chính thức `@google/genai`, Vitest. Không huấn luyện mô hình. Kho hiện tại ban đầu trống; chưa có frontend hoặc cơ sở dữ liệu cũ.

## Chạy nhanh trên PowerShell

### Mở lại website bằng một lệnh

Trên Windows, mở **Git Bash** trong thư mục dự án rồi chạy:

```bash
bash start.sh
```

Script tự chuyển về thư mục dự án, cài dependencies nếu thiếu, generate Prisma, áp dụng migration, tạo danh mục kỹ năng nếu chưa có, rồi chạy cả backend và frontend. Khi website và API đã sẵn sàng, trình duyệt mặc định mở `http://127.0.0.1:5173`. Giữ terminal mở; `Ctrl+C` dừng các dịch vụ do lệnh này tạo. Dịch vụ đã chạy được tái sử dụng. Không thay mã đăng nhập, tiến độ, câu hỏi hay cấu hình Gemini; không thêm câu mock và không gọi Gemini khi khởi động.

Dùng `bash start.sh --no-open` nếu không muốn mở trình duyệt, hoặc `bash start.sh --help` để xem hướng dẫn. Bash trên Linux/macOS cũng dùng được khi đã có Node.js/npm và `.env` phù hợp trên máy đó. Trên PowerShell với dependencies/database đã sẵn sàng, dùng `npm run dev -- --open`.

Đây là launcher chạy trên máy local. Website có thể truy cập tại URL phía trên khi máy và dịch vụ đang chạy; script chưa triển khai website lên hosting công khai.

### Cài đặt lần đầu

Node.js 22.12+ (đã kiểm tra với Node 24.18), npm. Chạy từ thư mục gốc dự án:

```powershell
npm ci
npm run setup:local -- --mock
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Chạy các lệnh theo thứ tự trên; `npm run dev` chạy liên tục nên phải nằm cuối. Lệnh này chạy cả hai dịch vụ và tái sử dụng bản đã chạy; `Ctrl+C` chỉ dừng các tiến trình do chính lệnh đó tạo. Nếu muốn chạy riêng, dùng `npm run dev:api` và `npm run dev:web` ở hai terminal. Chỉ chạy một backend trên cổng 3000.

`setup:local -- --mock` tạo `.env` có khóa xác thực ngẫu nhiên và bật **mock rõ ràng**. Không ghi đè `.env` đã tồn tại. Xem `.env` trên máy để lấy token admin/teacher cho [bộ yêu cầu HTTP](api/tenselab.http). Không chia sẻ hoặc commit file này. Nếu npm yêu cầu cho phép install scripts, các package native/Prisma cần thiết đã được liệt kê trong `package.json` (`allowScripts`); npm cũ có thể không hỗ trợ trường này nhưng vẫn chạy install scripts theo cơ chế riêng.

Backend: `http://127.0.0.1:3000`, health: `/api/v1/health`. `db:seed` chỉ tạo danh mục và kỹ năng. Để thêm 30 ví dụ **mock dạng bản nháp**: `npm run db:seed -- --examples` (cần mock mode). Quản trị viên khác người tạo phải duyệt trước khi luyện tập.

Để tạo tài khoản local dễ đăng nhập, chạy `npm run db:seed:accounts`. Lệnh tạo admin, teacher và hai student (adaptive/baseline), in mã truy cập và lưu ở `.tmp/local-accounts.json` (được ignore). Dán mã vào `/login`; đây là tài khoản API/database thật, không dùng adapter demo. Chạy lại giữ nguyên mã và tiến độ; không sửa khóa/cấu hình Gemini hoặc thay thế tài khoản hiện có. Tiến trình dev tự tải lại staff credentials; `npm start` cần khởi động lại. Hai student được giao cho tài khoản Teacher đã seed, giữ nguyên mã và tiến độ. Các student này thuộc nhóm `local_qa_seed_*` để phân biệt với dữ liệu lớp học.

```powershell
npm run check
npm test
npm run demo
npm run build
npm start
```

`demo` dùng database tạm, mô phỏng duyệt câu mock, tạo học sinh ẩn danh, chấm câu trả lời, cập nhật mastery và xuất nghiên cứu; không sửa kho câu hỏi thật. Database tạm được xóa sau chạy. `npm start` cần build trước.

## Chuyển sang Gemini thật

Trong `.env`, đặt `AI_MOCK_MODE=false`, `GEMINI_API_KEY` và giá đầu vào/đầu ra hiện hành cho model primary. Không đặt khóa trong frontend. Model mặc định `gemini-3.5-flash-lite`; model nâng cao `gemini-3.8-flash` chỉ admin có thể chọn bằng `modelTier: "advanced"`, cần giá riêng. Không tự chuyển model khi lỗi. Xem [GEMINI_SETUP](docs/GEMINI_SETUP.md).

```powershell
$env:RUN_LIVE_GEMINI='true'
npm run test:live
Remove-Item Env:RUN_LIVE_GEMINI
```

Đây là lệnh **opt-in có thể tính phí**; cần migrations trước. Nếu không có biến opt-in, lệnh báo SKIPPED. Kiểm thử thường dùng mock, không gọi mạng và không cần API key.

## Tài liệu và cấu trúc

- [Kiến trúc và ranh giới Gemini/quy tắc](docs/AI_ARCHITECTURE.md)
- [Cấu hình Gemini, chi phí, retry](docs/GEMINI_SETUP.md)
- [Danh mục lỗi](docs/GRAMMAR_ERROR_TAXONOMY.md)
- [Thuật toán thích ứng và baseline](docs/ADAPTIVE_ALGORITHM.md)
- [Kế hoạch đánh giá](docs/AI_EVALUATION_PLAN.md)
- [API và phân quyền](docs/API_REFERENCE.md)
- `src/`: API, cấu hình, Gemini, prompts, schemas, ngân hàng câu hỏi, chẩn đoán, thuật toán, xác thực.
- `prisma/`: schema và migration SQL; `tests/`: kiểm thử đơn vị/tích hợp và 30 ví dụ; `scripts/`: seed/demo/live smoke; `api/`: request collection.

Đây là prototype có các biện pháp bảo vệ để triển khai thử nghiệm có kiểm soát. Frontend đã có ba trò luyện ngữ pháp, dashboard học sinh/giáo viên và nghiên cứu; xem [hướng dẫn frontend](docs/FRONTEND_IMPLEMENTATION.md). Cần hội đồng giáo viên đánh giá học liệu, TLS/reverse proxy, quản lý bí mật, backup và chính sách nghiên cứu trước khi dùng với học sinh thật. Task frontend không chạy paid Gemini test hoặc sửa cấu hình/key của chủ dự án; không suy diễn kết quả nghiên cứu từ dữ liệu mẫu.
