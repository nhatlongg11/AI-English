# Live local verification — 22 October 2026 (Asia/Bangkok)

The actual local application was tested through `http://127.0.0.1:5173/api/v1`, including Vite's proxy, Fastify, the configured Gemini account and the persistent SQLite database. No mock transport or demo adapter was used. The initial database contained no questions, students, attempts or usage records.

## Results

- Frontend route `/student/dashboard`: HTTP 200. Proxied health: `status: ok`, `aiMode: gemini`.
- Live model: `gemini-3.5-flash-lite`. Eight successful provider calls; zero mock calls. This includes the initial smoke test, four generation calls, one diagnosis from an interrupted QA run, and two diagnoses in the completed run.
- Provider-reported totals: 2,634 input tokens and 1,473 output tokens. Recorded application estimate: **$0.0044727**, using $0.30 input / $2.50 output per million tokens. These match the [Google Standard pricing checked for this model](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite); the application's estimate is not a billing invoice.
- Three live questions available for local QA: present simple, difficulty 1, one each of multiple choice, fill-in-the-blank and error correction. All API content and answer keys matched SQLite.
- One ambiguous generated fill-in question rejected: without a supplied verb, both “walks” and “goes” fit. Prompt version `tenselab-v2` now requires a base-form cue immediately after the blank, and deterministic validation rejects omissions. Regression tests cover the missing cue and all 30 authored fill-in variants.
- Completed QA group: `local_qa_10f1ad39`, anonymous student `2b1bcd90-648f-451b-ab02-76a0075d2467`.
- Six persisted attempts: three correct, one incorrect multiple-choice answer, two non-key free-text answers pending teacher review. Correct word-token ordering was checked through the same submission endpoint used by Sentence Builder.
- Two free-text diagnoses came from live Gemini, without fallback. They remained advisory: `correct: null`, `gradingSource: pending_teacher_review`.
- Student summary: **6 total / 4 confirmed / 3 correct / 2 pending / 75% confirmed accuracy / 30 XP**. The two pending attempts did not change mastery snapshots.
- Duplicate submission was rejected and saved-result recovery returned the original attempt. Missing credentials returned 401; a student could not access the admin research export (403).
- All six research rows matched the stored attempt IDs, correctness, question provenance, QA group and hashed answers in SQLite.
- The frontend's actual `ApiClient` was also exercised against real HTTP (resolving its relative URLs to Vite, without supplying mock responses). Student session, health, summary, duplicate-submission recovery, admin research and question-bank reads matched the same live records.
- Regression suite: **80 backend + 16 frontend tests passed**. These automated tests remain isolated and deterministic; they supplement the separate live checks above.

These are real provider/database operations using deliberately chosen QA answers. They are **not real student observations or evidence of learning effectiveness**. QA question approval notes explicitly identify coding-agent review, not human teacher sign-off. Have a teacher re-review content before classroom use; exclude `local_qa_*` groups from classroom analysis. The interrupted QA student was removed through the deletion API; actual Gemini usage was retained.

Browser automation was refused by the browser security policy, so this run does not claim visual click-through verification. HTTP and database checks were completed. Other tenses, physical touch interaction and production deployment are outside this live run's scope.

## Open the application

```powershell
npm run dev
```

This starts frontend and backend and reuses healthy existing services. Open `http://127.0.0.1:5173/login`. Leave demo mode by logging out, then use an actual access token. Existing staff tokens remain in `.env`; the QA student's token is in the ignored local file `.tmp/live-qa-access.json`. No credentials are included in this document or client bundle.

Only `AI_MOCK_MODE` was changed to `false`; the Gemini key, model, pricing, budget and staff credentials were preserved.

## Repeat the checks

The basic provider smoke test creates one live response and stores usage:

```powershell
$env:RUN_LIVE_GEMINI='true'
try { npm run test:live } finally { Remove-Item Env:RUN_LIVE_GEMINI }
```

The full local workflow requires running services, admin/teacher credentials and reviewed live difficulty-1 present-simple questions in all three formats:

```powershell
$env:RUN_LIVE_GEMINI='true'
try { npm run test:live:app } finally { Remove-Item Env:RUN_LIVE_GEMINI }
```

This can incur provider charges and creates a fresh labelled QA account and six attempts. It never approves questions. API rate limits remain enabled; the runner respects a limiter response before one retry. Reports are saved without credentials in `.tmp/live-app-verification.json`; QA student access is kept separately in `.tmp/live-qa-access.json`.
