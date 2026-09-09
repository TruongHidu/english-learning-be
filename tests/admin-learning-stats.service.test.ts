import assert from "node:assert/strict";
import { test } from "node:test";
import { AdminLearningStatsService } from "../src/services/admin-learning-stats.service.js";
import type {
    IAdminLearningStatsRepository,
    LessonSummaryRaw,
    TopLearnedTopicRaw,
} from "../src/repositories/interfaces/admin-learning-stats.repository.interface.js";
import type {
    ActiveUserStats,
    TopWrongQuestion,
    UserSummary,
} from "../src/types/admin-learning-stats.types.js";
import {
    getVietnamDayRangeUtc,
    getVietnamWeekRangeUtc,
} from "../src/utils/vietnam-date.js";

class MockLearningStatsRepository implements IAdminLearningStatsRepository {
    constructor(
        private userSummary: UserSummary = {
            totalUsers: 0,
            newUsersThisWeek: 0,
            newUsersThisMonth: 0,
            activeUsers: 0,
            blockedUsers: 0,
            activeToday: 0,
            activeLast7Days: 0,
            activeLast30Days: 0,
        },
        private lessonSummary: LessonSummaryRaw = {
            completedLessons: 0,
            completedSessions: 0,
            inProgressLessons: 0,
            passedSessions: 0,
            averageScore: 0,
        },
        private topWrongQuestions: TopWrongQuestion[] = [],
        private topLearnedTopics: TopLearnedTopicRaw[] = [],
        private activeUserStats: ActiveUserStats = {
            topLearners: [],
            topByStreak: [],
            topByXp: [],
        },
    ) {}

    lastNowPassed?: Date;

    async getUserSummary(now: Date): Promise<UserSummary> {
        this.lastNowPassed = now;
        return this.userSummary;
    }

    async getLessonSummary(): Promise<LessonSummaryRaw> {
        return this.lessonSummary;
    }

    async getTopWrongQuestions(_limit: number): Promise<TopWrongQuestion[]> {
        return this.topWrongQuestions;
    }

    async getTopLearnedTopics(_limit: number): Promise<TopLearnedTopicRaw[]> {
        return this.topLearnedTopics;
    }

    async getActiveUserStats(_limit: number): Promise<ActiveUserStats> {
        return this.activeUserStats;
    }
}

test("Vietnam day range calculates exact UTC instant range [dayStartUtc, nextDayStartUtc) for Asia/Ho_Chi_Minh", () => {
    // 2026-09-08 20:43:23 UTC+7 (13:43:23Z)
    const ref = new Date("2026-09-08T13:43:23.000Z");
    const { dayStartUtc, nextDayStartUtc } = getVietnamDayRangeUtc(ref);

    // 2026-09-08 00:00:00 UTC+7 is 2026-09-07 17:00:00 UTC
    assert.equal(dayStartUtc.toISOString(), "2026-09-07T17:00:00.000Z");
    // 2026-09-09 00:00:00 UTC+7 is 2026-09-08 17:00:00 UTC
    assert.equal(nextDayStartUtc.toISOString(), "2026-09-08T17:00:00.000Z");
});

test("Vietnam week range calculates Monday-based week range for Asia/Ho_Chi_Minh", () => {
    // 2026-09-09 (Wednesday in Vietnam)
    const ref = new Date("2026-09-09T05:00:00.000Z");
    const { weekStartUtc, nextWeekStartUtc } = getVietnamWeekRangeUtc(ref);

    // Monday of this week is 2026-09-07 00:00:00 UTC+7 = 2026-09-06 17:00:00 UTC
    assert.equal(weekStartUtc.toISOString(), "2026-09-06T17:00:00.000Z");
    // Next Monday is 2026-09-14 00:00:00 UTC+7 = 2026-09-13 17:00:00 UTC
    assert.equal(nextWeekStartUtc.toISOString(), "2026-09-13T17:00:00.000Z");
});

test("Empty database returns zeros, empty arrays and no division by zero errors", async () => {
    const repo = new MockLearningStatsRepository();
    const fixedNow = new Date("2026-09-09T10:00:00.000Z");
    const service = new AdminLearningStatsService(repo, () => fixedNow);

    const result = await service.getAnalytics();

    assert.equal(result.userSummary.totalUsers, 0);
    assert.equal(result.lessonSummary.completedLessons, 0);
    assert.equal(result.lessonSummary.completedSessions, 0);
    assert.equal(result.lessonSummary.passedRate, 0);
    assert.equal(result.lessonSummary.averageScore, 0);
    assert.equal(Number.isNaN(result.lessonSummary.passedRate), false);
    assert.equal(Number.isNaN(result.lessonSummary.averageScore), false);
    assert.deepEqual(result.topWrongQuestions, []);
    assert.deepEqual(result.topLearnedTopics, []);
    assert.deepEqual(result.activeUserStats.topLearners, []);
    assert.equal(result.generatedAt, "2026-09-09T10:00:00.000Z");
});

test("Passed rate and average score calculations", async () => {
    const repo = new MockLearningStatsRepository(
        {
            totalUsers: 50,
            newUsersThisWeek: 5,
            newUsersThisMonth: 12,
            activeUsers: 48,
            blockedUsers: 2,
            activeToday: 15,
            activeLast7Days: 30,
            activeLast30Days: 45,
        },
        {
            completedLessons: 40,
            completedSessions: 10,
            inProgressLessons: 3,
            passedSessions: 8,
            averageScore: 84.56,
        },
    );

    const service = new AdminLearningStatsService(repo);
    const result = await service.getAnalytics();

    // 8 / 10 * 100 = 80.0%
    assert.equal(result.lessonSummary.passedRate, 80);
    assert.equal(result.lessonSummary.averageScore, 84.6);
    assert.equal(result.userSummary.totalUsers, 50);
});

test("Topic popularity percentages calculated relative to the top topic", async () => {
    const repo = new MockLearningStatsRepository(
        undefined,
        undefined,
        [],
        [
            {
                topicId: "topic-1",
                topicName: "Giao tiếp cơ bản",
                studyCount: 100,
                uniqueLearners: 50,
            },
            {
                topicId: "topic-2",
                topicName: "Du lịch & Khám phá",
                studyCount: 60,
                uniqueLearners: 35,
            },
            {
                topicId: "topic-3",
                topicName: "Công sở",
                studyCount: 25,
                uniqueLearners: 15,
            },
        ],
    );

    const service = new AdminLearningStatsService(repo);
    const result = await service.getAnalytics();

    assert.equal(result.topLearnedTopics.length, 3);
    // 100 / 100 = 100%
    assert.equal(result.topLearnedTopics[0]?.percentage, 100);
    // 60 / 100 = 60%
    assert.equal(result.topLearnedTopics[1]?.percentage, 60);
    // 25 / 100 = 25%
    assert.equal(result.topLearnedTopics[2]?.percentage, 25);
});

test("Propagates repository errors cleanly without unhandled rejection", async () => {
    const errorRepo: IAdminLearningStatsRepository = {
        async getUserSummary() {
            throw new Error("Database timeout");
        },
        async getLessonSummary() {
            throw new Error("Database timeout");
        },
        async getTopWrongQuestions() {
            return [];
        },
        async getTopLearnedTopics() {
            return [];
        },
        async getActiveUserStats() {
            return { topLearners: [], topByStreak: [], topByXp: [] };
        },
    };

    const service = new AdminLearningStatsService(errorRepo);
    await assert.rejects(async () => {
        await service.getAnalytics();
    }, /Database timeout/);
});
