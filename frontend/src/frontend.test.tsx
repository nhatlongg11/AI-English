import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./features/auth/Auth";
import { Login } from "./features/auth/Login";
import { Protected, App } from "./App";
import { Practice } from "./features/learning/Practice";
import { AIStudio } from "./features/teacher/AIStudio";
import { QuestionReview } from "./features/teacher/QuestionReview";
import {
  SentenceBuilder,
  transferWord,
} from "./components/games/SentenceBuilder";
import { TooltipProvider } from "./components/ui/tooltip";
import { ApiClient, ApiError } from "./services/api";
import { demoBank, demoSession, demoSummary } from "./services/demo";
import { dailyAccuracy } from "./components/charts/LearningCharts";
import { csvData } from "./features/research/Research";
import type { Assignment, Feedback, Role } from "./types";
function signedIn(role: Role = "student") {
  sessionStorage.setItem(
    "tenselab-session-v1",
    JSON.stringify({ session: demoSession(role), token: "" }),
  );
}
function mount(ui: React.ReactNode, path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <TooltipProvider>{ui}</TooltipProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}
const assignment: Assignment = {
  decisionId: "assigned-1",
  question: {
    id: "question-1",
    tense: "present_simple",
    difficulty: 1,
    questionType: "multiple_choice",
    content: "She ____ to school every day.",
    options: ["go", "goes", "going", "went"],
    provenance: "gemini",
    model: "backend-configured-model",
    generatedAt: "2026-10-21",
  },
  reason: { skillId: "present_simple:E01" },
  generationNeeded: null,
};
const feedback: Feedback = {
  attemptId: "attempt-1",
  correct: true,
  correctAnswer: "goes",
  explanationVi: "She là ngôi thứ ba số ít, động từ go thêm es.",
  requiresTeacherReview: false,
  diagnosis: {
    status: "unclassified",
    correctedSentence: "goes",
    errorCodes: [],
    explanationVi: "Dùng goes với she.",
    source: "answer_key",
    provenance: "teacher_approved",
  },
  mastery: { mastery: 1 },
  gradingSource: "stored_option_key",
};
describe("authentication and protected navigation", () => {
  it("validates an existing bearer token with the real session endpoint", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ role: "teacher", actorId: "teacher-1" }),
          { status: 200 },
        ),
      );
    mount(
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/teacher/dashboard" element={<p>Teacher destination</p>} />
      </Routes>,
    );
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Mã truy cập của bạn"),
      "existing-test-access-code",
    );
    await user.click(screen.getByRole("button", { name: "Vào TenseLab" }));
    expect(await screen.findByText("Teacher destination")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/auth/session",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer existing-test-access-code",
        }),
      }),
    );
  });
  it("does not grant access after failed authentication", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 }),
    );
    mount(<Login />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Mã truy cập của bạn"), "incorrect");
    await user.click(screen.getByRole("button", { name: "Vào TenseLab" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("không hợp lệ");
    expect(sessionStorage.getItem("tenselab-session-v1")).toBeNull();
  });
  it("redirects a student away from teacher routes", async () => {
    signedIn();
    mount(
      <Routes>
        <Route element={<Protected roles={["teacher", "admin"]} />}>
          <Route
            path="/teacher/dashboard"
            element={<p>Secret teacher area</p>}
          />
        </Route>
        <Route path="/student/dashboard" element={<p>Student area</p>} />
      </Routes>,
      "/teacher/dashboard",
    );
    expect(await screen.findByText("Student area")).toBeInTheDocument();
    expect(screen.queryByText("Secret teacher area")).not.toBeInTheDocument();
  });
  it("student navigation opens grammar lessons and logout clears the session", async () => {
    signedIn();
    mount(<App />, "/student/dashboard");
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: /Chào Minh Anh/ });
    await user.click(screen.getByRole("link", { name: "Khám phá ngữ pháp" }));
    expect(
      await screen.findByRole("heading", { name: "Ngữ pháp, từng chút một" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Đăng xuất" }));
    expect(
      await screen.findByRole("heading", { name: /Chào mừng bạn trở lại/ }),
    ).toBeInTheDocument();
  });
  it("teacher navigation opens the question bank", async () => {
    signedIn("teacher");
    mount(<App />, "/teacher/dashboard");
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: /Chào thầy cô/ });
    await user.click(screen.getByRole("link", { name: "Ngân hàng câu hỏi" }));
    expect(
      await screen.findByRole("heading", { name: "Ngân hàng câu hỏi" }),
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText("Sửa lỗi / xếp câu", { exact: false }))
        .length,
    ).toBeGreaterThan(0);
  });
});
describe("learning interactions", () => {
  it("renders four provided options, hides feedback, prevents duplicate submissions, and shows reward", async () => {
    signedIn();
    vi.spyOn(ApiClient.prototype, "next").mockResolvedValue(assignment);
    let resolve!: (value: Feedback) => void;
    const submit = vi.spyOn(ApiClient.prototype, "submit").mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    mount(<Practice />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Bắt đầu 5 câu hỏi" }));
    expect(
      await screen.findByText(assignment.question!.content),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Các đáp án" })).getAllByRole(
        "button",
      ),
    ).toHaveLength(4);
    expect(screen.queryByText(feedback.explanationVi)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Kiểm tra đáp án" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /B\s*goes/ }));
    await user.dblClick(
      screen.getByRole("button", { name: "Kiểm tra đáp án" }),
    );
    expect(submit).toHaveBeenCalledTimes(1);
    resolve({...feedback,correctAnswer:'GOES'});
    expect(
      await screen.findByRole("heading", { name: /Chính xác/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(feedback.explanationVi)).toBeInTheDocument();
    expect(screen.getByRole('button',{name:/B\s*goes/})).toHaveClass('correct');
    expect(screen.getByRole("button", { name: "Câu tiếp theo" })).toBeEnabled();
  });
  it("retains typed answers and allows retry after a network interruption", async () => {
    signedIn();
    vi.spyOn(ApiClient.prototype, "next").mockResolvedValue({
      ...assignment,
      question: {
        ...assignment.question!,
        questionType: "error_correction",
        content: "He go to school yesterday.",
        options: [],
      },
    });
    vi.spyOn(ApiClient.prototype, "submit")
      .mockRejectedValueOnce(
        new ApiError(0, "NETWORK_ERROR", "Mất kết nối thử nghiệm"),
      )
      .mockResolvedValue({
        ...feedback,
        correct: null,
        requiresTeacherReview: true,
      });
    mount(<Practice />, "/?game=detective");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Bắt đầu 5 câu hỏi" }));
    await user.type(
      await screen.findByLabelText("Câu đã sửa của bạn"),
      "He went to school yesterday.",
    );
    await user.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mất kết nối");
    expect(screen.getByLabelText("Câu đã sửa của bạn")).toHaveValue(
      "He went to school yesterday.",
    );
    await user.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
    expect(
      await screen.findByRole("heading", { name: /cần kiểm tra thêm/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/không làm giảm điểm/)).toBeInTheDocument();
  });
  it("supports repeated words, keyboard assembly, reordering, and reset", async () => {
    const onChange = vi.fn();
    const tokens = [
      { id: "one", text: "that" },
      { id: "two", text: "that" },
      { id: "three", text: "works" },
    ];
    mount(<SentenceBuilder tokens={tokens} onChange={onChange} />);
    const user = userEvent.setup();
    const add = screen.getAllByRole("button", { name: "Thêm từ that" });
    await user.click(add[0]);
    await user.click(screen.getByRole("button", { name: "Thêm từ works" }));
    await user.click(screen.getByRole("button", { name: "Thêm từ that" }));
    expect(onChange).toHaveBeenLastCalledWith(["one", "three", "two"]);
    const left = screen.getAllByRole("button", { name: "Dịch that sang trái" });
    await user.click(left[1]);
    expect(onChange).toHaveBeenLastCalledWith(["one", "two", "three"]);
    await user.click(screen.getByRole("button", { name: "Xếp lại" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(
      screen.getAllByRole("button", { name: "Thêm từ that" }),
    ).toHaveLength(2);
  });
  it("keeps token identity during a transfer between drop zones", () =>
    expect(
      transferWord({ pool: ["a", "b"], sentence: ["c"] }, "b", "sentence"),
    ).toEqual({ pool: ["a"], sentence: ["c", "b"] }));
});
describe("teacher workflows and research accuracy", () => {
  it("never makes draft questions available to students in the demo adapter", () => {
    const before = demoSummary().available.reduce((n, a) => n + a._count, 0);
    demoBank.push({
      ...demoBank[0],
      id: "temporary-draft-test",
      status: "draft",
    });
    try {
      expect(demoSummary().available.reduce((n, a) => n + a._count, 0)).toBe(
        before,
      );
    } finally {
      demoBank.pop();
    }
  });
  it("AI Studio calls the typed generation adapter and never claims success after failure", async () => {
    signedIn("teacher");
    vi.spyOn(ApiClient.prototype, "health").mockResolvedValue({
      status: "ok",
      aiMode: "gemini",
    });
    const generate = vi
      .spyOn(ApiClient.prototype, "generate")
      .mockRejectedValue(new Error("Dịch vụ AI đang bận"));
    mount(<AIStudio />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Tạo câu hỏi nháp" }));
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        tense: "present_simple",
        questionType: "multiple_choice",
        difficulty: 1,
        count: 3,
        modelTier: "primary",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dịch vụ AI đang bận",
    );
    expect(screen.queryByText("3 câu hỏi đã tạo")).not.toBeInTheDocument();
  });
  it("requires a review note and attestation before approval", async () => {
    signedIn("admin");
    const q = { ...demoBank[0], status: "draft" as const };
    const review = vi
      .spyOn(ApiClient.prototype, "review")
      .mockResolvedValue({ ...q, status: "approved" });
    const updated = vi.fn();
    mount(
      <QuestionReview question={q} onClose={() => {}} onReviewed={updated} />,
    );
    const user = userEvent.setup();
    expect(
      screen.getByRole("button", { name: "Duyệt & xuất bản" }),
    ).toBeDisabled();
    await user.type(
      screen.getByLabelText("Ghi chú kiểm duyệt (ít nhất 5 ký tự)"),
      "Đã kiểm tra ngữ pháp và đáp án.",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Duyệt & xuất bản" }));
    await waitFor(() =>
      expect(review).toHaveBeenCalledWith(
        q.id,
        "approve",
        "Đã kiểm tra ngữ pháp và đáp án.",
      ),
    );
    expect(updated).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved" }),
    );
  });
  it("excludes pending answers from chart accuracy", () => {
    const result = dailyAccuracy([
      { createdAt: "2026-10-21T10:00:00Z", correct: true },
      { createdAt: "2026-10-21T11:00:00Z", correct: null },
      { createdAt: "2026-10-21T12:00:00Z", correct: false },
    ]);
    expect(result[0]).toMatchObject({ accuracy: 50, total: 2 });
  });
  it("escapes formula injection when exporting visible research rows", () => {
    expect(
      csvData([{ experimentGroup: '=HYPERLINK("bad")' } as never]),
    ).toContain("'=HYPERLINK");
  });
  it("recovers an already-submitted result without a second grading call", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "ALREADY_SUBMITTED" }), {
          status: 409,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(feedback), { status: 200 }),
      );
    expect(
      await new ApiClient("test").submit("assigned-1", { answer: "goes" }),
    ).toMatchObject({ correct: true });
    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/v1/learning/assignments/assigned-1/result",
      expect.anything(),
    );
  });
});
