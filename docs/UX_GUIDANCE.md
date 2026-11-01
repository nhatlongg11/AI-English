# Plain language and on-page guidance

The student/account flow now uses **Cách giao bài** instead of technical mode names:

| UI wording | Existing API value | Explanation |
| --- | --- | --- |
| Bài tập theo sức học | `adaptive` | Selects practice based on previous answers and adjusts difficulty. |
| Bài tập theo thứ tự | `baseline` | Keeps the predefined exercise sequence. |

The first option stays selected by default. Cards explain the difference without requiring English or research terminology. Optional evaluation labels are inside a closed **Tùy chọn cho đợt đánh giá** disclosure. Ordinary learning uses the group value `general`; a custom label still follows the existing API rules. Labels do not create classes. Existing account modes, groups, tokens and progress are unchanged.

Navigation now says **Học sinh**. The page explains the actual account workflow: create one access code per learner, send it privately, and see the learner immediately, including before their first answer. Teachers create codes and see only their assigned students and reports. Administrators assign students and approve questions; authors cannot approve their own questions. Group labels still do not create classes. Practice, chart legends and report filters use the same path labels. Research exports retain their original machine-readable fields and values.

## Guided tours

Shepherd.js **15.3.0** loads on demand from the top-bar **Hướng dẫn** button. A dismissible first-use invitation offers **Chỉ mình với**; no tour launches automatically. Invitation dismissal is stored locally per account and role, with no access codes stored by the guide.

Tours depend on the current page and role: teacher overview, account creation, question generation/review, learning reports, student dashboard, grammar, practice and progress. They only explain controls; they do not create accounts, submit answers, approve questions or call Gemini. Unavailable/hidden targets are skipped, including mobile navigation. Step counters reflect currently available targets. On navigation, search changes, logout or unmount, an active tour is cancelled. It can be replayed at any time.

The guide has Vietnamese controls, back/next/skip, an accessible close button, Shepherd keyboard navigation and Escape. Scrolling respects reduced-motion preference. Theme overrides use TenseLab's lavender header, purple actions, rounded cards, soft shadow, typography and focus ring, with viewport-limited width and scrollable content.

- Guide definitions: `frontend/src/features/guidance/tour.ts`
- Lifecycle and persistence: `frontend/src/features/guidance/use-page-guide.ts`
- Theme: `frontend/src/features/guidance/tour.css`
- Shared path wording: `frontend/src/lib/learning-copy.ts`
- Regression coverage: `frontend/src/guidance.test.tsx`, using the actual Shepherd library

Package license is AGPL-3.0 with commercial terms offered upstream; see [third-party notes](FRONTEND_THIRD_PARTY.md) and the [official license](https://github.com/shipshapecode/shepherd/blob/main/LICENSE.md). No license was purchased or project license changed.

Browser automation is unavailable due to the browser security policy in this session. Tour behavior was checked with the actual library in the DOM test environment, supplemented by TypeScript, production build and live local HTTP/API checks; no fresh visual screenshot is claimed.
