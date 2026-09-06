import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveStreakTimezone } from "../src/config/streak.config.js";
import { calculateStreakTransition, effectiveCurrentStreak, localDayNumber } from "../src/utils/streak.js";
import { UserStatsService } from "../src/services/user-stats.service.js";
import { UserService } from "../src/services/user.service.js";
import { AuthService } from "../src/services/auth.service.js";
import { HeartService } from "../src/services/heart.service.js";
import { VocabularyReviewService } from "../src/services/vocabulary-review.service.js";
import type { IUserRepository } from "../src/repositories/interfaces/user.repository.interface.js";
import type { IUserVocabularyRepository } from "../src/repositories/interfaces/user-vocabulary.repository.interface.js";
import type { IVocabularyRepository } from "../src/repositories/interfaces/vocabulary.repository.interface.js";
import type { IPasswordHasher } from "../src/security/password-hasher.interface.js";
import type { ITokenService } from "../src/security/token-service.interface.js";
import type { User, UserStats } from "../src/types/auth.types.js";
import { AppError } from "../src/errors/app-error.js";

const at = (iso: string) => new Date(iso);
const now = at("2026-09-06T18:00:00Z"); // September 7, 01:00 in Vietnam
const initialStats = (): UserStats => ({
    currentHeart: 5, maxHeart: 5, heartUpdatedAt: now,
    totalXp: 90, level: 1, diamond: 20, currentStreak: 0, longestStreak: 0,
});

function harness(overrides: Partial<UserStats> = {}) {
    const user: User = {
        id: "64f000000000000000000001", email: "learner@example.com", displayName: "Learner",
        authProvider: "LOCAL", role: "USER", status: "ACTIVE", passwordHash: "hashed",
        stats: { ...initialStats(), ...overrides }, createdAt: now, updatedAt: now,
    };
    let writes = 0;
    const repository = {
        findById: async () => structuredClone(user),
        findByEmail: async () => structuredClone(user),
        updateLastLogin: async () => {},
        updateStats: async (_id: string, update: Partial<UserStats>) => {
            writes++;
            Object.assign(user.stats, update);
            return structuredClone(user);
        },
    } as unknown as IUserRepository;
    const service = new UserStatsService(repository);
    return { user, repository, service, writes: () => writes };
}

test("timezone defaults, override and invalid configuration", () => {
    assert.equal(resolveStreakTimezone(), "Asia/Ho_Chi_Minh");
    assert.equal(resolveStreakTimezone("  UTC  "), "UTC");
    assert.throws(() => resolveStreakTimezone("Invalid/Timezone"), /Invalid STREAK_TIMEZONE/);
    assert.equal(calculateStreakTransition(at("2026-09-06T16:59:59Z"), now, "UTC"), "SAME_DAY");
});

test("different Vietnam days within one UTC day are consecutive", () => {
    assert.equal(calculateStreakTransition(at("2026-09-06T16:59:59Z"), at("2026-09-06T17:00:00Z")), "NEXT_DAY");
});

test("different UTC days within one Vietnam day do not increment", () => {
    assert.equal(calculateStreakTransition(at("2026-09-06T23:59:59Z"), at("2026-09-07T00:00:00Z")), "SAME_DAY");
});

test("calendar dates work at year, leap-day and DST boundaries", () => {
    for (const [start, end, timezone] of [
        ["2026-12-31T16:59:59Z", "2026-12-31T17:00:00Z", "Asia/Ho_Chi_Minh"],
        ["2024-02-28T17:00:00Z", "2024-02-29T17:00:00Z", "Asia/Ho_Chi_Minh"],
        ["2026-03-08T05:00:00Z", "2026-03-09T04:00:00Z", "America/New_York"],
    ]) {
        assert.equal(localDayNumber(at(end!), timezone) - localDayNumber(at(start!), timezone), 1);
    }
});

test("first activity starts at one even for a legacy user with a stale counter", async () => {
    const h = harness({ currentStreak: 8, longestStreak: 12 });
    const result = await h.service.applyLessonCompletionStats(h.user.id, h.user.stats, 10, 5, now);
    assert.equal(result.currentStreak, 1);
    assert.equal(result.longestStreak, 12);
    assert.equal(result.totalXp, 100);
    assert.equal(result.level, 2);
    assert.equal(result.diamond, 25);
});

test("same-day activities preserve streak while accumulating rewards and latest timestamp", async () => {
    const h = harness();
    await h.service.applyLessonCompletionStats(h.user.id, h.user.stats, 10, 5, now);
    const later = at("2026-09-06T19:00:00Z");
    const result = await h.service.applyLessonCompletionStats(h.user.id, h.user.stats, 5, 0, later);
    assert.equal(result.currentStreak, 1);
    assert.equal(result.longestStreak, 1);
    assert.equal(result.totalXp, 105);
    assert.equal(result.diamond, 25);
    assert.deepEqual(result.lastStudyDate, later);
});

test("consecutive local day increments streak and longest record", async () => {
    const h = harness({ currentStreak: 3, longestStreak: 3, lastStudyDate: at("2026-09-06T16:59:59Z") });
    const result = await h.service.applyLessonCompletionStats(h.user.id, h.user.stats, 5, 0, now);
    assert.equal(result.currentStreak, 4);
    assert.equal(result.longestStreak, 4);
});

test("missing a complete local day restarts at one without losing record", async () => {
    const h = harness({ currentStreak: 3, longestStreak: 8, lastStudyDate: at("2026-09-05T16:59:59Z") });
    const result = await h.service.applyLessonCompletionStats(h.user.id, h.user.stats, 5, 0, now);
    assert.equal(result.currentStreak, 1);
    assert.equal(result.longestStreak, 8);
});

test("future dates and out-of-order activities never increment or move lastStudyDate backwards", async () => {
    const future = at("2026-09-08T18:00:00Z");
    const h = harness({ currentStreak: 3, longestStreak: 8, lastStudyDate: future });
    const result = await h.service.applyLessonCompletionStats(h.user.id, h.user.stats, 5, 0, now);
    assert.equal(result.currentStreak, 3);
    assert.deepEqual(result.lastStudyDate, future);
    assert.equal(result.totalXp, 95);
});

test("effective streak expires at local midnight after a missed day, without modifying stats", () => {
    const stats = { currentStreak: 5, longestStreak: 10, lastStudyDate: at("2026-09-05T16:59:59Z") };
    const before = structuredClone(stats);
    assert.equal(effectiveCurrentStreak(stats, at("2026-09-06T16:59:59Z")), 5);
    assert.equal(effectiveCurrentStreak(stats, at("2026-09-06T17:00:00Z")), 0);
    assert.deepEqual(stats, before);
    assert.equal(effectiveCurrentStreak(undefined, now), 0);
    assert.equal(effectiveCurrentStreak({ currentStreak: 5 }, now), 0);
});

test("profile and login return expired streak without changing response fields or stored stats", async () => {
    const h = harness({ currentStreak: 5, longestStreak: 10, lastStudyDate: at("2000-01-01T00:00:00Z") });
    const before = structuredClone(h.user.stats);
    const hearts = new HeartService(h.repository);
    const hasher = { compare: async () => true } as unknown as IPasswordHasher;
    const tokens = { generateAccessToken: () => "token" } as unknown as ITokenService;
    const profile = await new UserService(h.repository, hasher, hearts, {} as IUserVocabularyRepository).getProfile(h.user.id);
    assert.equal(profile.stats.currentStreak, 0);
    assert.equal(profile.stats.longestStreak, 10);
    assert.deepEqual(Object.keys(profile).sort(), ["id", "email", "displayName", "avatarUrl", "authProvider", "role", "status", "stats", "createdAt"].sort());
    assert.deepEqual(Object.keys(profile.stats).sort(), ["currentHeart", "maxHeart", "nextHeartAt", "diamond", "totalXp", "level", "currentStreak", "longestStreak"].sort());
    const login = await new AuthService(h.repository, hasher, tokens, hearts).login({ email: h.user.email, password: "password" });
    assert.equal(login.user.stats.currentStreak, 0);
    assert.deepEqual(Object.keys(login).sort(), ["accessToken", "user"]);
    assert.deepEqual(Object.keys(login.user).sort(), ["id", "email", "displayName", "avatarUrl", "role", "stats"].sort());
    assert.deepEqual(Object.keys(login.user.stats).sort(), ["currentHeart", "maxHeart", "nextHeartAt", "diamond", "totalXp", "level", "currentStreak"].sort());
    assert.deepEqual(h.user.stats, before);
    assert.equal(h.writes(), 0);
});

test("a valid review, including an incorrect answer, earns streak with the existing reward shape", async () => {
    const h = harness();
    const vocab = { reviewLevel: 0, correctCount: 0, reviewCount: 0, incorrectCount: 0, status: "LEARNED" };
    const repository = {
        findByUserAndVocabulary: async (_id: string, vocabularyId: string) => vocabularyId === "known" ? vocab : null,
        updateReviewResult: async () => vocab,
    } as unknown as IUserVocabularyRepository;
    const review = new VocabularyReviewService(repository, {} as IVocabularyRepository, h.service, h.repository);
    const empty = await review.submitReviewResults(h.user.id, [{ vocabularyId: "unknown", isCorrect: true }]);
    assert.equal(empty.rewards, null);
    assert.equal(h.writes(), 0);
    const result = await review.submitReviewResults(h.user.id, [{ vocabularyId: "known", isCorrect: false }]);
    assert.deepEqual(Object.keys(result).sort(), ["results", "rewards"]);
    assert.deepEqual(result.rewards, { xpEarned: 5, totalXp: 95, level: 1, currentStreak: 1 });
    assert.equal(h.user.stats.diamond, 20);
    assert.equal(h.writes(), 1);
});

test("conflicts retry a bounded number of times and never report an uncommitted reward", async () => {
    const h = harness();
    let attempts = 0;
    h.repository.updateStats = async () => { attempts++; return null; };
    await assert.rejects(() => h.service.applyLessonCompletionStats(h.user.id, h.user.stats, 5, 0, now),
        (error: unknown) => error instanceof AppError && error.code === "USER_STATS_UPDATE_CONFLICT");
    assert.equal(attempts, 10);
    assert.equal(h.writes(), 0);
});

test("unknown database outcomes are not retried and a disappeared user reports not found", async () => {
    const h = harness();
    let attempts = 0;
    const error = new Error("Connection closed after write");
    h.repository.updateStats = async () => { attempts++; throw error; };
    await assert.rejects(() => h.service.applyLessonCompletionStats(h.user.id, h.user.stats, 5, 0, now), error);
    assert.equal(attempts, 1);
    h.repository.updateStats = async () => null;
    h.repository.findById = async () => null;
    await assert.rejects(() => h.service.applyLessonCompletionStats(h.user.id, h.user.stats, 5, 0, now),
        (error: unknown) => error instanceof AppError && error.code === "USER_NOT_FOUND");
});
