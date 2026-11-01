# TenseLab AI — Frontend

Giao diện đã được bổ sung lời hướng dẫn gần gũi và tour Shepherd.js theo trang/vai trò. Bấm **Hướng dẫn** ở góc trên để xem lại; xem [chi tiết wording, tour và kiểm thử](UX_GUIDANCE.md).

Ngân hàng câu hỏi cũng có **Tự soạn câu hỏi** và **Nhập từ tệp** (CSV/JSON), với preview và kiểm tra từng dòng; xem [hướng dẫn tạo/nhập câu](QUESTION_AUTHORING.md). Metadata người tạo được thêm bằng migration, không thay đổi cấu hình Gemini hay các lượt học đã có.

Giao diện React + TypeScript + Vite + Tailwind CSS nằm riêng trong `frontend/`, dùng lại Fastify API `/api/v1`. Không tạo kết nối Gemini từ trình duyệt; không sửa `.env`, API key, giá/model hoặc schema cơ sở dữ liệu. Server hiện có được giữ nguyên, chỉ thêm các DTO/route tương thích để UI hoạt động với dữ liệu được cấp quyền.

## Chạy dự án

Từ thư mục gốc, Node 22.12+ (khuyến nghị Node 24), npm:

```powershell
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run dev` hiện chạy cả backend và frontend, tái sử dụng dịch vụ đang chạy. Muốn chạy riêng hai terminal:

```powershell
npm run dev:api
# terminal khác
npm run dev:web
```

Backend mặc định cổng 3000; frontend `http://127.0.0.1:5173`. Vite proxy `/api` sang backend, không cần mở CORS rộng. Nếu backend đã chạy, không mở thêm bản trùng cổng. Dùng `.env` hiện có; **không cần tạo khóa Gemini mới**. Trang đăng nhập nhận bearer token nhà trường cấp, role được xác minh qua `/auth/session`. Chưa có đăng nhập email/mật khẩu hay đăng ký tự do; trang `/register` giải thích cách nhận mã. Admin cấp student token trong Học sinh & tài khoản, token chỉ trả một lần và DB lưu hash.

Có thể chọn **Khám phá giao diện mẫu** ở trang login để xem các vai trò. Adapter demo dùng dữ liệu tổng hợp trong trình duyệt, không cấp quyền backend, không ghi nghiên cứu thật, không gọi Gemini. Banner BẢN MẪU luôn hiển thị; kết quả và export đều có nhãn DEMO. Dữ liệu này dùng để thuyết trình giao diện, không chứng minh hiệu quả giáo dục.

Production frontend:

```powershell
npm run build
npm run build:web
npm start
# terminal khác
npm run preview:web
```

Preview: `http://127.0.0.1:4173`, proxy API cổng 3000. Static build ở `dist/frontend`, backend ở `dist/src`; không ghi đè lẫn nhau. Khi deploy thật, cấu hình reverse proxy `/api` vào Fastify và fallback SPA về `index.html` cho các route frontend. Không dùng Vite dev/preview như production application server.

## Trang và tương tác

- `/login`, `/register`: xác thực token hiện có, trạng thái lỗi, phân vai, hướng dẫn cấp mã, demo tách biệt.
- `/student/dashboard`: lời chào, XP tính từ câu đúng đã xác nhận, accuracy, module availability, kỹ năng, chart và hoạt động gần nhất.
- `/student/grammar`, `/student/grammar/:tense`: 3 thì, công thức, ví dụ Anh/Việt, lỗi thường gặp, tiến độ và luyện theo chủ đề.
- `/student/practice`: Tense Challenge, Sentence Builder, Grammar Detective; 5 câu/phiên, chống nộp lặp, bảo toàn feedback khi đang tải câu kế tiếp, giải thích, uncertainty và XP.
- `/student/practice/result`: kết quả phiên, pending answers, React Bits CountUp, mốc 3 câu đúng và nút tiếp tục.
- Cấp độ được tính từ 100 XP/cấp; khi một phiên vượt mốc, React Bits CountUp hiển thị cấp mới. Đây là chỉ số game, không phải điểm nghiên cứu chuẩn hóa.
- `/student/progress`: accuracy theo ngày, theo tense, lỗi đã phân loại và mastery theo skill.
- `/teacher/dashboard`: kho câu, chờ duyệt, độ phủ học liệu và trạng thái dữ liệu lớp học.
- `/teacher/question-bank`: tìm trên trang, filter tense/status, phân trang 100 câu, preview key/explanation/mapping cho người có quyền, approve/reject dành cho admin, approve có attestation và chặn tự duyệt.
- `/teacher/ai-studio`: tense/type/difficulty/count/target error/theme; model advanced chỉ admin chọn rõ ràng; loading và lỗi API thực; không báo thành công khi thất bại.
- `/teacher/students`: teacher/admin cấp mã và xem danh sách kể cả chưa có lượt làm; teacher chỉ thấy học sinh mình phụ trách, admin có thể phân công lại.
- `/teacher/analytics`, `/research/dashboard`: biểu đồ từ nhật ký được cấp quyền, filter mode/group/tense, CSV/JSON, labels thiếu pre/post-test; research chỉ admin.
- `/help`: hướng dẫn, vai trò và thông tin phiên, không hiển thị token.

## Kiến trúc frontend và dependencies

`features/` chia auth/student/learning/teacher/research. `services/api.ts` là client DTO cho API thật; `services/demo.ts` là adapter tổng hợp tách biệt. `components/ui` lấy từ registry shadcn/ui chính thức (new-york-v4, Radix). ChartContainer/ChartTooltip dùng Recharts 3, không có thư viện chart khác. `components/games/SentenceBuilder.tsx` dùng `@dnd-kit/react` 0.5 với useSortable, useDroppable, DragDropProvider/DragOverlay và helpers hiện tại.

Word token có ID ổn định, khác nhau dù trùng chữ; không dùng index hoặc text làm React key. Mouse/touch qua PointerSensor mặc định dnd-kit; drag handle có `touch-action:none`; nút thêm/trả từ và dịch trái/phải hỗ trợ bàn phím/touch không cần kéo. Bấm Xếp lại để làm lại trước khi nộp. Sau khi nộp, assignment bất biến; luyện lại bắt đầu assignment tiếp theo để tránh sửa dữ liệu nghiên cứu đã ghi.

`components/rewards/CountUp.tsx` là React Bits chính thức, có license kèm theo; `Reward.tsx` dùng CountUp cho XP/hoàn thành cùng Motion nhẹ. `prefers-reduced-motion` được áp dụng cho CSS, MotionConfig và CountUp. Route được lazy-load, Recharts/dnd/Motion chia chunk; không đưa ảnh/video nặng hoặc game engine vào bundle.

Dependencies chính mới: React/React DOM, React Router, Vite + React plugin, Tailwind + Vite plugin, radix-ui, lucide-react, class-variance-authority, clsx, tailwind-merge, sonner, next-themes (dependency của shadcn Sonner), @dnd-kit/react/helpers, motion và recharts. Dev: ESLint/TypeScript ESLint/React Hooks, Testing Library/user-event/jest-dom, jsdom. Dùng lockfile để tái lập.

## Hợp đồng API

Tích hợp các API sẵn có: health, question generation/list/approval/rejection, next-question, attempts, research export, student provisioning. Diagnosis sinh ngay khi nộp câu tự do và trả trong feedback; UI dùng phản hồi đó, không gọi AI lần nữa để lấy cùng giải thích. Mastery được trả qua summary và từ response submit.

Các phần tương thích thêm, không cần migration:

| API / mở rộng | Quyền và chức năng |
|---|---|
| GET `/api/v1/auth/session` | Xác minh token, trả role/actorId/mode/group; không credential |
| GET `/api/v1/learning/students/:id/summary` | Chính student; counters toàn bộ, XP = correct × 10, tối đa 100 activity gần nhất, snapshots và approved availability |
| GET next-question `?tense=&questionType=` | Scope luyện tự chọn; giữ assignment chưa nộp cùng scope; ghi practiceContext trong reason |
| `publicQuestion.wordTokens` | Chỉ error_correction; shuffled opaque IDs/text từ đáp án đã duyệt, không lộ vị trí đáp án |
| POST attempts `tokenIds` thay `answer` | Server xác minh đủ token, không trùng/không lạ, tự dựng text và dùng grading hiện có |
| GET `/api/v1/learning/assignments/:id/result` | Chính student sau khi đã nộp; lấy lại kết quả khi mất response, không tạo attempt mới |

Adaptive và baseline vẫn giữ mode phân nhóm. Luyện tự chọn ghi `practiceContext:student_selected_practice`; dashboard nghiên cứu mặc định loại các lượt đó khỏi so sánh lộ trình. Raw logs vẫn giữ đầy đủ. Không gửi thuật toán priority nội bộ cho UI trẻ em; chỉ hiển thị tên kỹ năng.

## Dữ liệu và giới hạn có chủ ý

- Teacher không có quyền đọc hồ sơ tùy ý; chưa có roster hoặc quan hệ teacher/class. Các trang vẫn có layout/loading/empty/error, nhưng báo rõ khoảng trống tích hợp. Admin dùng export ẩn danh sẵn có cho báo cáo, không nới quyền teacher.
- Không có pre/post-test, retention test, hoặc baseline covariates trong schema/API. Giá trị hiển thị “— / Chưa có API”, không giả lập kết quả nghiên cứu.
- Mastery là snapshot thuật toán, không phải thang đo giáo dục đã hiệu chỉnh. Chart theo ngày/tense/lỗi của student dùng tối đa 100 lượt gần nhất; tổng counters tính trên toàn bộ lượt. Teacher bank metrics ghi rõ phạm vi trang, không giả làm tổng toàn bank.
- Research UI tải tối đa 10.000 rows, phân trang 1.000, cảnh báo nếu bị cắt. Export UI chứa dữ liệu đã tải sau filter, không phải mọi row không giới hạn. CSV có chống formula injection; không xuất bearer token/PII/raw free-text answers.
- Free text khác key có correct null và chờ review; AI chỉ advisory. Chưa có adjudication UI/API cho giáo viên. Không tính pending là sai vào chart hoặc mastery.
- Auth dùng token phiên trong sessionStorage, không lưu Gemini key. Chưa có SSO, token expiry/refresh hoặc quyền theo lớp; các chức năng này cần backend tiếp theo.
- Chỉ mock được dùng trong automated tests. Không tự chạy paid Gemini smoke trong task frontend và không thay đổi model/key của chủ dự án.

## Kiểm thử

```powershell
npm run check
npm run check:web
npm run lint
npm test
npm run test:web
npm run build
npm run build:web
npm run verify:client
npm audit
```

Backend integration tests dùng SQLite tạm, xác minh session/ownership, scoped assignments, token ordering, counters/XP và result recovery. Frontend tests kiểm tra login qua API thật được mock fetch, role guards, navigation, 4 options, feedback secrecy, duplicate submissions, network retry, uncertainty, repeated token IDs, keyboard alternatives/reset, generation API adapter, approval attestation, chart denominator và CSV injection. Đây không phải test live Gemini.

Browser QA cần kiểm tra desktop/mobile, kéo thả chuột, nút bàn phím, Grammar Detective uncertainty, generation/review mẫu, charts và console. PointerSensor hỗ trợ touch; kiểm thử thiết bị cảm ứng vật lý vẫn cần thực hiện trước thi. `.env` được đọc kiểm tra secret leakage sau build mà không sửa hoặc in khóa ra output.

## Kết quả kiểm tra ngày 22/10/2026

- Backend: **88/88 tests đạt**, gồm AI Core, compatibility, verb cue và 8 kiểm tra authoring/import theo transaction.
- Frontend: **28/28 tests đạt** trong 4 files, gồm API client → Fastify → SQLite tạm, UI/tour và 7 kiểm tra form/CSV/JSON/preview/chuyển sang duyệt bài.
- TypeScript backend/frontend, ESLint, production builds và client credential scan đạt. Audit registry tại thời điểm kiểm tra: **0 vulnerabilities**.
- Đợt UI ban đầu đã kiểm tra browser desktop 1440px và mobile 390px: navigation, chọn đáp án, feedback/XP/summary, mouse drag, keyboard ordering, AI Studio/review mô phỏng, research labels/charts và uncertainty đạt. Các bổ sung authoring/tour mới được kiểm tra bằng DOM tests và HTTP/database; browser automation hiện bị policy chặn, không có screenshot mới cho các bổ sung này.
- Production preview cổng 4173: dashboard và các game lazy-load thành công, console không có warning/error. Auth context/hook được tách khỏi provider component để tránh thay đổi identity trong hot reload.
- `.env` được giữ nguyên; SHA-256 trước/sau kiểm tra giống nhau. Không có paid Gemini call trong task frontend.
- Bằng chứng giao diện với **dữ liệu mẫu**: [desktop](screenshots/student-desktop.jpg), [mobile](screenshots/student-mobile.jpg).

Các file mới nằm trong `frontend/`, `eslint.config.js`, `src/sentence-tokens.ts`, `src/question-authoring.ts`, bộ tests và tài liệu/screenshot frontend. File được mở rộng gồm `src/app.ts`, `src/learning.ts`, `src/questions.ts`, package/lockfile và tài liệu. Prisma schema được bổ sung `Question.createdBy` nullable bằng migration để lưu tác giả câu tự soạn/nhập; cấu hình Gemini giữ nguyên trong bổ sung này.

Cập nhật phân quyền teacher/admin và migration Student.teacherId: xem [ROLES_AND_PERMISSIONS](ROLES_AND_PERMISSIONS.md).
