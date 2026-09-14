import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateAdaptiveReview,
  calculatePriority,
  normalizeReviewAnswer,
} from "../src/services/vocabulary-review.service.js";
import {
  createReviewSessionSchema,
  submitReviewAnswerSchema,
} from "../src/validators/user-vocabulary-review.validator.js";

const now = new Date("2026-09-14T00:00:00.000Z");
const base = {
  reviewLevel: 3,
  reviewCount: 4,
  correctCount: 3,
  incorrectCount: 1,
  correctStreak: 2,
  lapseCount: 0,
  averageResponseTimeMs: 5_000,
  isBookmarked: false,
  lastReviewedAt: new Date("2026-09-10T00:00:00.000Z"),
  nextReviewAt: new Date("2026-09-13T00:00:00.000Z"),
};

test("review answer normalization is conservative and Unicode-safe", () => {
  assert.equal(
    normalizeReviewAnswer("  EnVironment   Protection "),
    "environment protection",
  );
  assert.equal(normalizeReviewAnswer("cafe\u0301"), "café");
});

test("priority favors unseen, overdue, weak and frequently wrong words with an explainable reason", () => {
  const unseen = calculatePriority(
    { ...base, reviewCount: 0, lastReviewedAt: null },
    now,
  );
  const stable = calculatePriority(
    { ...base, nextReviewAt: new Date("2026-09-20T00:00:00.000Z") },
    now,
  );
  const weak = calculatePriority(
    { ...base, reviewLevel: 0, correctCount: 1, incorrectCount: 5 },
    now,
  );
  assert.equal(unseen.reason, "NEVER_REVIEWED");
  assert.ok(weak.score > stable.score);
  assert.ok(["LOW_MASTERY", "FREQUENTLY_WRONG"].includes(weak.reason));
});

test("adaptive SRS keeps retry mastery, demotes failures and never exceeds level five", () => {
  assert.equal(calculateAdaptiveReview(3, "RETRY_CORRECT", 0, now).level, 3);
  assert.equal(calculateAdaptiveReview(3, "FAIL", 0, now).level, 2);
  assert.equal(calculateAdaptiveReview(5, "EASY", 0, now).level, 5);
  assert.equal(
    calculateAdaptiveReview(0, "FAIL", 0, now).nextReviewAt.getTime(),
    now.getTime(),
  );
});

test("session validation uses scope instead of conflicting dueOnly and supports phase-three modes", () => {
  const parsed = createReviewSessionSchema.parse({
    selectionMode: "WORD_COUNT",
    wordCount: 10,
  });
  assert.equal(parsed.scope, "SMART_QUEUE");
  assert.equal(parsed.mode, "SMART_REVIEW");
  assert.equal(
    createReviewSessionSchema.safeParse({ selectionMode: "TIME" }).success,
    false,
  );
  assert.equal(
    createReviewSessionSchema.safeParse({
      selectionMode: "WORD_COUNT",
      wordCount: 10,
      dueOnly: true,
    }).success,
    false,
  );
});

test("answer validation requires the real selected or typed response", () => {
  const questionId = "64f000000000000000000001";
  assert.equal(
    submitReviewAnswerSchema.safeParse({
      questionId,
      responseTimeMs: 1000,
      usedHint: false,
    }).success,
    false,
  );
  assert.equal(
    submitReviewAnswerSchema.safeParse({
      questionId,
      typedAnswer: "answer",
      responseTimeMs: 1000,
      usedHint: false,
    }).success,
    true,
  );
});
