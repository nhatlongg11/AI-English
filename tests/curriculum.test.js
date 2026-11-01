import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from 'node:v8';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import * as domain from '../src/domain.js';
import { curriculumQuestions, curriculumAuthor, lessons, seedCurriculum, validateCurriculum, importCurriculum } from '../scripts/seed-curriculum.mjs';

describe('original starter curriculum', () => {
  it('does not run the loader when imported from an inline script', () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      "await import('./scripts/seed-curriculum.mjs'); console.log('import-only');"], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('import-only');
    expect(result.stderr).toBe('');
  });
  it('passes the same validators used to publish questions', () => {
    expect(() => validateCurriculum(domain)).not.toThrow();
    expect(curriculumQuestions).toHaveLength(135);
    expect(new Set(curriculumQuestions.map(domain.contentHash)).size).toBe(135);
  });

  it('covers every tense, game format and difficulty with constrained answer keys', () => {
    for (const tense of domain.tenses) {
      expect(lessons[tense]).toHaveLength(15);
      for (const questionType of ['multiple_choice', 'fill_in_blank', 'error_correction']) {
        for (const difficulty of [1, 2, 3, 4, 5]) {
          expect(curriculumQuestions.filter(q => q.tense === tense && q.questionType === questionType && q.difficulty === difficulty)).toHaveLength(3);
        }
      }
    }
    expect(new Set(curriculumQuestions.map(q => q.errorCode))).toEqual(new Set(domain.errorCodes));
    for (const q of curriculumQuestions) {
      expect(q.explanationVi).toMatch(/[àáảãạăâđêôơư]/u);
      if (q.questionType === 'fill_in_blank') expect(q.content).toMatch(/____\s*\([a-z]+(?:[ '-][a-z]+)*\)/i);
      if (q.questionType === 'multiple_choice') {
        expect(q.options.filter(option => option.text === q.correctAnswer)).toHaveLength(1);
        expect(q.options.every(option => option.errorCode === null)).toBe(true);
      }
    }
  });

  it('varies correct option positions and constructs grammatical sentence keys from each lesson', () => {
    const positions = new Set();
    for (const [index, q] of curriculumQuestions.entries()) {
      if (q.questionType !== 'multiple_choice') continue;
      positions.add(q.options.findIndex(option => option.text === q.correctAnswer));
      const fill = curriculumQuestions[index + 1];
      const correction = curriculumQuestions[index + 2];
      const sentence = fill.content.split('and full forms: ')[1];
      expect(sentence.replace(/____\s*\([a-z]+(?:[ '-][a-z]+)*\)/i, fill.correctAnswer)).toBe(correction.correctAnswer);
      expect(correction.content.endsWith(correction.correctAnswer)).toBe(false);
    }
    expect(positions).toEqual(new Set([0, 1, 2, 3]));
  });
});

// Transactional fake for importer behavior; database-backed coverage lives separately.
function memoryDatabase(initial = [], failAfter = Infinity) {
  let records = deserialize(serialize(initial));
  const db = {
    records: () => records,
    $transaction: async callback => {
      const next = deserialize(serialize(records));
      const result = await callback({ question: {
        findMany: async ({ where }) => next.filter(q => where.contentHash.in.includes(q.contentHash)),
        create: async ({ data }) => {
          if (next.length >= failAfter) throw new Error('Simulated write failure');
          next.push(data);
        },
      } });
      records = next;
      return result;
    },
  };
  return db;
}
const importingDomain = { ...domain, seedTaxonomy: async () => {} };

describe('curriculum import', () => {
  it('inserts truthful drafts without fabricating review metadata', async () => {
    const db = memoryDatabase();
    expect(await seedCurriculum(db, importingDomain)).toMatchObject({ added: 135, skipped: 0 });
    for (const q of db.records()) {
      expect(q.status).toBe('draft');
      expect(q.provenance).toBe('ai_assisted_curriculum');
      expect(q.createdBy).toBe(curriculumAuthor);
      expect(q.reviewedBy).toBeUndefined();
      expect(q.reviewedAt).toBeUndefined();
      expect(JSON.parse(q.reviewFlags)).toContain('difficulty_not_calibrated');
    }
  });

  it('is repeatable and preserves existing approved/rejected/edited questions', async () => {
    const first = curriculumQuestions[0];
    const existing = { ...first, contentHash: domain.contentHash(first), status: 'rejected', reviewNote: 'Keep this decision' };
    const db = memoryDatabase([existing]);
    expect(await seedCurriculum(db, importingDomain)).toMatchObject({ added: 134, skipped: 1 });
    expect(await seedCurriculum(db, importingDomain)).toMatchObject({ added: 0, skipped: 135 });
    expect(db.records()[0]).toEqual(existing);
  });

  it('rejects an invalid pack before writing and rolls back a failed import', async () => {
    const db = memoryDatabase();
    await expect(seedCurriculum(db, importingDomain, [{ ...curriculumQuestions[0], correctAnswer: 'not an option' }])).rejects.toThrow();
    expect(db.records()).toHaveLength(0);
    const failing = memoryDatabase([], 7);
    await expect(seedCurriculum(failing, importingDomain)).rejects.toThrow('Simulated write failure');
    expect(failing.records()).toHaveLength(0);
  });
});

describe('authenticated website import', () => {
  function website(role = 'teacher', invalidBatch = -1) {
    let previews = 0;
    const records = new Map();
    const fetcher = async (url, options) => {
      expect(options.headers.authorization).toBe('Bearer test-token');
      expect(options.redirect).toBe('error');
      const result = value => ({ ok: true, json: async () => value });
      if (url.endsWith('/auth/session')) return result({ role });
      const { questions } = JSON.parse(options.body);
      expect(questions.length).toBeLessThanOrEqual(50);
      if (url.endsWith('/preview')) return result({
        invalidCount: previews++ === invalidBatch ? 1 : 0,
        readyCount: questions.filter(q => !records.has(domain.contentHash(q))).length,
      });
      expect(previews).toBeGreaterThanOrEqual(3);
      const added = [];
      for (const q of questions) {
        const digest = domain.contentHash(q);
        if (records.has(digest)) continue;
        records.set(digest, q);
        added.push(q);
      }
      return result({ questions: added, skipped: questions.length - added.length });
    };
    return { fetcher, records };
  }

  it('previews every batch before writing, discloses AI-assisted authorship, and skips repeats', async () => {
    const server = website();
    expect(await importCurriculum('https://school.example', 'test-token', domain, server)).toMatchObject({ added: 135, skipped: 0, status: 'draft' });
    expect(await importCurriculum('https://school.example', 'test-token', domain, server)).toMatchObject({ added: 0, skipped: 135 });
    expect([...server.records.values()].every(q => q.grammarRule.includes('AI hỗ trợ'))).toBe(true);
  });

  it('does not write in dry-run mode or when the last preview fails', async () => {
    const server = website();
    expect(await importCurriculum('https://school.example', 'test-token', domain, { ...server, dryRun: true })).toMatchObject({ ready: 135, databaseChanged: false });
    expect(server.records.size).toBe(0);
    const invalid = website('teacher', 2);
    await expect(importCurriculum('https://school.example', 'test-token', domain, invalid)).rejects.toThrow('preview');
    expect(invalid.records.size).toBe(0);
  });

  it('does not allow a student to import or send credentials over remote HTTP', async () => {
    const student = website('student');
    await expect(importCurriculum('https://school.example', 'test-token', domain, student)).rejects.toThrow('teacher or administrator');
    expect(student.records.size).toBe(0);
    await expect(importCurriculum('http://school.example', 'test-token', domain, student)).rejects.toThrow('HTTPS');
  });
});
