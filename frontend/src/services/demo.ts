import type {
  Assignment,
  BankQuestion,
  Feedback,
  GenerateRequest,
  QuestionType,
  ResearchRow,
  Role,
  Session,
  Summary,
  Tense,
} from "../types";
import { topics } from "../lib/grammar";
const sentences = [
  [
    "She walks to school every day.",
    "walks",
    "Every day, she ____ to school.",
    "walk",
    "E01",
  ],
  [
    "She is reading a book now.",
    "is reading",
    "Look! She ____ a book now.",
    "reading",
    "E03",
  ],
  [
    "They went to the zoo yesterday.",
    "went",
    "Yesterday, they ____ to the zoo.",
    "goed",
    "E04",
  ],
];
export const demoBank: BankQuestion[] = topics.flatMap((t, i) =>
  Array.from({ length: 3 }, (_, j) => ({
    id: `demo-${t.id}-${j}`,
    tense: t.id,
    difficulty: j + 1,
    questionType: (
      ["multiple_choice", "error_correction", "fill_in_blank"] as QuestionType[]
    )[j],
    content:
      j === 1
        ? `Correct this sentence: ${sentences[i][0].replace(sentences[i][1], sentences[i][3])}`
        : sentences[i][2],
    options:
      j === 0
        ? [
            { text: sentences[i][3], errorCode: sentences[i][4] },
            { text: sentences[i][1], errorCode: null },
            {
              text: i === 0 ? "walking" : i === 1 ? "are reading" : "goes",
              errorCode: sentences[i][4],
            },
          ]
        : [],
    correctAnswer: j === 1 ? sentences[i][0] : sentences[i][1],
    explanationVi: t.tip,
    grammarRule: t.structure,
    errorCode: sentences[i][4],
    status: "approved",
    reviewedBy: "DEMO reviewer",
    reviewFlags: '["synthetic_development_fixture"]',
    provenance: "synthetic_demo",
    model: "frontend-fixture",
    generatedAt: new Date().toISOString(),
  })),
);
export function demoSession(role: Role): Session {
  return {
    role,
    actorId: `demo-${role}`,
    demo: true,
    mode: "adaptive",
    experimentGroup: "DEMO",
  };
}
export function demoSummary(): Summary {
  const attempts = Array.from({ length: 36 }, (_, i) => ({
    id: `demo-attempt-${i}`,
    correct: i % 5 !== 0,
    errorCode: i % 5 === 0 ? "E01" : null,
    createdAt: new Date(
      Date.now() - Math.floor(i / 5) * 86400000,
    ).toISOString(),
    mode: i % 2 ? "baseline" : "adaptive",
    question: { tense: topics[i % 3].id, content: sentences[i % 3][2] },
  }));
  const correct = attempts.filter((a) => a.correct).length;
  return {
    skills: topics.map((t, i) => ({
      skillId: `${t.id}:${sentences[i][4]}`,
      tense: t.id,
      errorCode: sentences[i][4],
      attempts: 12,
      recentAccuracy: [0.83, 0.75, 0.67][i],
      mastery: [0.78, 0.62, 0.45][i],
      recentErrors: i + 1,
      difficulty: 2,
      lastPracticedAt: new Date().toISOString(),
    })),
    attempts,
    total: 36,
    confirmed: 36,
    correct,
    xp: correct * 10,
    available: demoBank
      .filter((q) => q.status === "approved")
      .map((q) => ({
        tense: q.tense,
        questionType: q.questionType,
        _count: 1,
      })),
    activityWindow: 100,
  };
}
const assigned = new Map<string, BankQuestion>();
let sequence = 0;
export function demoNext(scope: {
  tense?: Tense;
  questionType?: QuestionType;
}): Assignment {
  const pool = demoBank.filter(
    (q) =>
      (!scope.tense || q.tense === scope.tense) &&
      (!scope.questionType || q.questionType === scope.questionType) &&
      q.status === "approved",
  );
  const q = pool[sequence++ % pool.length];
  if (!q)
    return {
      decisionId: "demo-empty",
      question: null,
      reason: {},
      generationNeeded: { demo: true },
    };
  const id = `demo-decision-${sequence}`;
  assigned.set(id, q);
  const {
    correctAnswer: _answer,
    explanationVi: _explanation,
    grammarRule: _rule,
    errorCode: _code,
    status: _status,
    reviewedBy: _reviewer,
    reviewFlags: _flags,
    ...rest
  } = q;
  void _answer;
  void _explanation;
  void _rule;
  void _code;
  void _status;
  void _reviewer;
  void _flags;
  return {
    decisionId: id,
    question: {
      ...rest,
      options: q.options.map((o) => o.text),
      wordTokens:
        q.questionType === "error_correction"
          ? q.correctAnswer
              .split(" ")
              .map((text, i) => ({ id: `demo-word-${q.id}-${i}`, text }))
              .reverse()
          : undefined,
    },
    reason: { mode: "adaptive", skillId: `${q.tense}:${q.errorCode}` },
    generationNeeded: null,
  };
}
export function demoSubmit(
  id: string,
  body: { answer?: string; tokenIds?: string[] },
): Feedback {
  const q = assigned.get(id);
  if (!q) throw new Error("Bài mẫu đã kết thúc. Hãy bắt đầu lại.");
  const words = q.correctAnswer.split(" ");
  const answer =
    body.answer ??
    body.tokenIds?.map((id) => words[Number(id.split("-").at(-1))]).join(" ") ??
    "";
  const matches = answer.trim().toLowerCase() === q.correctAnswer.toLowerCase();
  const correct =
    q.questionType === "multiple_choice" ? matches : matches ? true : null;
  assigned.delete(id);
  return {
    attemptId: `demo-answer-${sequence}`,
    correct,
    correctAnswer: q.correctAnswer,
    explanationVi: q.explanationVi,
    requiresTeacherReview: correct === null,
    diagnosis: {
      status:
        correct === false
          ? "classified"
          : correct === null
            ? "uncertain"
            : "unclassified",
      errorCodes: correct === false ? [q.errorCode] : [],
      correctedSentence: q.correctAnswer,
      explanationVi: q.explanationVi,
      source: "synthetic_demo",
      provenance: "synthetic_demo",
    },
    mastery: { mastery: matches ? 0.8 : 0.5 },
    gradingSource: "synthetic_demo",
  };
}
export function demoGenerate(request: GenerateRequest) {
  const source = demoBank.find(
    (q) => q.tense === request.tense && q.questionType === request.questionType,
  )!;
  const questions = Array.from({ length: request.count }, (_, i) => ({
    ...source,
    id: `demo-draft-${Date.now()}-${i}`,
    difficulty: request.difficulty,
    status: "draft" as const,
    reviewedBy: null,
    content: `${source.content} (${i + 1})`,
  }));
  demoBank.unshift(...questions);
  return { questions };
}
export function demoResearch(): ResearchRow[] {
  return demoSummary().attempts.map((a, i) => ({
    attemptId: a.id,
    anonymousStudentId: `demo-student-${i % 6}`,
    questionId: demoBank[i % demoBank.length].id,
    tense: a.question.tense,
    skillId: `${a.question.tense}:E01`,
    correct: a.correct,
    errorCode: a.errorCode,
    createdAt: a.createdAt,
    mode: a.mode,
    experimentGroup: a.mode === "adaptive" ? "A-DEMO" : "B-DEMO",
    gradingSource: "synthetic_demo",
    algorithm: "demo",
    reason: "synthetic",
    answerHash: "not-collected",
    provenance: "synthetic_demo",
  }));
}
