import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { sentenceTokens } from "../src/sentence-tokens.js";
import { auth, testConfig, testDb, teacherToken } from "./helpers.js";
describe("frontend compatibility contracts", () => {
  let fixture: Awaited<ReturnType<typeof testDb>>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    fixture = await testDb();
    app = await buildApp({ db: fixture.db, config: testConfig() });
  });
  afterEach(async () => {
    await app.close();
    await fixture.cleanup();
  });
  async function student() {
    return (
      await app.inject({
        method: "POST",
        url: "/api/v1/learning/students",
        headers: auth(),
        payload: { mode: "adaptive", experimentGroup: "A" },
      })
    ).json() as { id: string; token: string };
  }
  async function publish(questionType = "error_correction") {
    const data = (
      await app.inject({
        method: "POST",
        url: "/api/v1/ai/questions/generate",
        headers: auth(teacherToken),
        payload: {
          tense: "present_simple",
          difficulty: 1,
          questionType,
          count: 1,
        },
      })
    ).json();
    const q = data.questions[0];
    await app.inject({
      method: "POST",
      url: `/api/v1/ai/questions/${q.id}/approve`,
      headers: auth(),
      payload: {
        note: "Simulated review for isolated integration test",
        checkedGrammarAndAnswer: true,
      },
    });
    return q;
  }
  it("identifies the real role and anonymous student without exposing credentials", async () => {
    const s = await student();
    const session = await app.inject({
      url: "/api/v1/auth/session",
      headers: auth(s.token),
    });
    expect(session.json()).toMatchObject({
      role: "student",
      actorId: s.id,
      mode: "adaptive",
    });
    expect(session.body).not.toContain("tokenHash");
    expect(
      (
        await app.inject({
          url: "/api/v1/auth/session",
          headers: auth(teacherToken),
        })
      ).json().role,
    ).toBe("teacher");
    expect((await app.inject("/api/v1/auth/session")).statusCode).toBe(401);
  });
  it("scopes approved questions to game format and validates opaque token IDs server-side", async () => {
    await publish("multiple_choice");
    const q = await publish();
    const s = await student();
    const next = (
      await app.inject({
        url: `/api/v1/learning/students/${s.id}/next-question?questionType=error_correction&tense=present_simple`,
        headers: auth(s.token),
      })
    ).json();
    expect(next.question.questionType).toBe("error_correction");
    expect(next.question.correctAnswer).toBeUndefined();
    const tokens = next.question.wordTokens as { id: string; text: string }[];
    expect(tokens).toHaveLength(q.correctAnswer.split(" ").length);
    const invalid = await app.inject({
      method: "POST",
      url: "/api/v1/learning/attempts",
      headers: auth(s.token),
      payload: {
        decisionId: next.decisionId,
        tokenIds: tokens.map(() => tokens[0]!.id),
      },
    });
    expect(invalid.statusCode).toBe(400);
    const available = [...tokens];
    const ordered = q.correctAnswer.split(" ").map(
      (word: string) =>
        available.splice(
          available.findIndex((t) => t.text === word),
          1,
        )[0]!.id,
    );
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/learning/attempts",
      headers: auth(s.token),
      payload: { decisionId: next.decisionId, tokenIds: ordered },
    });
    expect(response.json()).toMatchObject({
      correct: true,
      correctAnswer: q.correctAnswer,
    });
    const summary = await app.inject({
      url: `/api/v1/learning/students/${s.id}/summary`,
      headers: auth(s.token),
    });
    expect(summary.json()).toMatchObject({
      total: 1,
      confirmed: 1,
      correct: 1,
      xp: 10,
    });
    expect(summary.body).not.toContain("correctAnswer");
    expect(summary.body).not.toContain("tokenHash");
    const recovery = await app.inject({
      url: `/api/v1/learning/assignments/${next.decisionId}/result`,
      headers: auth(s.token),
    });
    expect(recovery.json()).toMatchObject({ correct: true, recovered: true });
    const other = await student();
    expect(
      (
        await app.inject({
          url: `/api/v1/learning/assignments/${next.decisionId}/result`,
          headers: auth(other.token),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          url: `/api/v1/learning/students/${s.id}/summary`,
          headers: auth(other.token),
        })
      ).statusCode,
    ).toBe(403);
  });
  it("does not reveal a result before submission", async () => {
    const q = await publish();
    const s = await student();
    const next = (
      await app.inject({
        url: `/api/v1/learning/students/${s.id}/next-question`,
        headers: auth(s.token),
      })
    ).json();
    expect(next.question.id).toBe(q.id);
    expect(
      (
        await app.inject({
          url: `/api/v1/learning/assignments/${next.decisionId}/result`,
          headers: auth(s.token),
        })
      ).statusCode,
    ).toBe(404);
  });
  it("keeps repeated words individually identifiable and token IDs stable", () => {
    const first = sentenceTokens("example", "They said that that was true.");
    expect(first.filter((t) => t.text === "that")).toHaveLength(2);
    expect(new Set(first.map((t) => t.id)).size).toBe(6);
    expect(sentenceTokens("example", "They said that that was true.")).toEqual(
      first,
    );
  });
});
