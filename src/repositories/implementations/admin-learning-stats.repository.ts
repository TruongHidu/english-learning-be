import { Types } from "mongoose";
import { UserModel } from "../../models/user.model.js";
import { LearningSessionModel } from "../../models/learning-session.model.js";
import { UserLessonProgressModel } from "../../models/user-lesson-progress.model.js";
import { QuestionModel } from "../../models/question.model.js";
import { LessonQuestionModel } from "../../models/lesson-question.model.js";
import { LessonModel } from "../../models/lesson.model.js";
import { TopicModel } from "../../models/topic.model.js";
import type {
    IAdminLearningStatsRepository,
    LessonSummaryRaw,
    TopLearnedTopicRaw,
} from "../interfaces/admin-learning-stats.repository.interface.js";
import type {
    ActiveLearner,
    ActiveUserStats,
    TopWrongQuestion,
    UserSummary,
} from "../../types/admin-learning-stats.types.js";
import {
    getVietnamDayRangeUtc,
    getVietnamMonthRangeUtc,
    getVietnamWeekRangeUtc,
} from "../../utils/vietnam-date.js";

export class AdminLearningStatsRepository implements IAdminLearningStatsRepository {
    async getUserSummary(now: Date = new Date()): Promise<UserSummary> {
        const { dayStartUtc } = getVietnamDayRangeUtc(now);
        const { weekStartUtc } = getVietnamWeekRangeUtc(now);
        const { monthStartUtc } = getVietnamMonthRangeUtc(now);

        const last7DaysUtc = new Date(dayStartUtc.getTime() - 6 * 24 * 60 * 60 * 1000);
        const last30DaysUtc = new Date(dayStartUtc.getTime() - 29 * 24 * 60 * 60 * 1000);

        // Also query active users from learning sessions to capture recent learners
        const [
            facetResult,
            sessionTodayUsers,
            session7DaysUsers,
            session30DaysUsers,
        ] = await Promise.all([
            UserModel.aggregate<{
                totalUsers: { count: number }[];
                activeUsers: { count: number }[];
                blockedUsers: { count: number }[];
                newUsersThisWeek: { count: number }[];
                newUsersThisMonth: { count: number }[];
                activeToday: { count: number }[];
                activeLast7Days: { count: number }[];
                activeLast30Days: { count: number }[];
            }>([
                { $match: { role: "USER" } },
                {
                    $facet: {
                        totalUsers: [{ $count: "count" }],
                        activeUsers: [
                            { $match: { status: "ACTIVE" } },
                            { $count: "count" },
                        ],
                        blockedUsers: [
                            { $match: { status: { $in: ["LOCKED", "BANNED"] } } },
                            { $count: "count" },
                        ],
                        newUsersThisWeek: [
                            { $match: { createdAt: { $gte: weekStartUtc } } },
                            { $count: "count" },
                        ],
                        newUsersThisMonth: [
                            { $match: { createdAt: { $gte: monthStartUtc } } },
                            { $count: "count" },
                        ],
                        activeToday: [
                            { $match: { "stats.lastStudyDate": { $gte: dayStartUtc } } },
                            { $count: "count" },
                        ],
                        activeLast7Days: [
                            { $match: { "stats.lastStudyDate": { $gte: last7DaysUtc } } },
                            { $count: "count" },
                        ],
                        activeLast30Days: [
                            { $match: { "stats.lastStudyDate": { $gte: last30DaysUtc } } },
                            { $count: "count" },
                        ],
                    },
                },
            ]),
            LearningSessionModel.distinct("userId", { startedAt: { $gte: dayStartUtc } }),
            LearningSessionModel.distinct("userId", { startedAt: { $gte: last7DaysUtc } }),
            LearningSessionModel.distinct("userId", { startedAt: { $gte: last30DaysUtc } }),
        ]);

        const facet = facetResult[0] ?? {
            totalUsers: [],
            activeUsers: [],
            blockedUsers: [],
            newUsersThisWeek: [],
            newUsersThisMonth: [],
            activeToday: [],
            activeLast7Days: [],
            activeLast30Days: [],
        };

        const totalUsers = facet.totalUsers[0]?.count ?? 0;
        const activeUsers = facet.activeUsers[0]?.count ?? 0;
        const blockedUsers = facet.blockedUsers[0]?.count ?? 0;
        const newUsersThisWeek = facet.newUsersThisWeek[0]?.count ?? 0;
        const newUsersThisMonth = facet.newUsersThisMonth[0]?.count ?? 0;

        // Combine UserModel.stats.lastStudyDate and LearningSession distinct users
        const [activeTodayCount, active7DaysCount, active30DaysCount] = await Promise.all([
            UserModel.countDocuments({
                role: "USER",
                status: "ACTIVE",
                $or: [
                    { "stats.lastStudyDate": { $gte: dayStartUtc } },
                    { _id: { $in: sessionTodayUsers } },
                ],
            }),
            UserModel.countDocuments({
                role: "USER",
                status: "ACTIVE",
                $or: [
                    { "stats.lastStudyDate": { $gte: last7DaysUtc } },
                    { _id: { $in: session7DaysUsers } },
                ],
            }),
            UserModel.countDocuments({
                role: "USER",
                status: "ACTIVE",
                $or: [
                    { "stats.lastStudyDate": { $gte: last30DaysUtc } },
                    { _id: { $in: session30DaysUsers } },
                ],
            }),
        ]);

        return {
            totalUsers,
            newUsersThisWeek,
            newUsersThisMonth,
            activeUsers,
            blockedUsers,
            activeToday: activeTodayCount,
            activeLast7Days: active7DaysCount,
            activeLast30Days: active30DaysCount,
        };
    }

    async getLessonSummary(): Promise<LessonSummaryRaw> {
        const [
            completedLessonsAggregate,
            inProgressLessonsAggregate,
            sessionStats,
        ] = await Promise.all([
            UserLessonProgressModel.aggregate<{ count: number }>([
                { $match: { status: "COMPLETED" } },
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "user",
                    },
                },
                { $unwind: "$user" },
                { $match: { "user.role": "USER" } },
                { $count: "count" },
            ]),
            UserLessonProgressModel.aggregate<{ count: number }>([
                { $match: { status: "IN_PROGRESS" } },
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "user",
                    },
                },
                { $unwind: "$user" },
                { $match: { "user.role": "USER" } },
                { $count: "count" },
            ]),
            LearningSessionModel.aggregate<{
                completedSessions: number;
                passedSessions: number;
                averageScore: number;
            }>([
                { $match: { status: "COMPLETED" } },
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "user",
                    },
                },
                { $unwind: "$user" },
                { $match: { "user.role": "USER" } },
                {
                    $group: {
                        _id: null,
                        completedSessions: { $sum: 1 },
                        passedSessions: {
                            $sum: {
                                $cond: [
                                    { $gte: ["$score", { $ifNull: ["$requiredScore", 80] }] },
                                    1,
                                    0,
                                ],
                            },
                        },
                        averageScore: { $avg: "$score" },
                    },
                },
            ]),
        ]);

        const sessionAggregate = sessionStats[0];

        return {
            completedLessons: completedLessonsAggregate[0]?.count ?? 0,
            inProgressLessons: inProgressLessonsAggregate[0]?.count ?? 0,
            completedSessions: sessionAggregate?.completedSessions ?? 0,
            passedSessions: sessionAggregate?.passedSessions ?? 0,
            averageScore: sessionAggregate?.averageScore ?? 0,
        };
    }

    async getTopWrongQuestions(limit: number): Promise<TopWrongQuestion[]> {
        const aggregation = await LearningSessionModel.aggregate<{
            wrongCounts: { _id: Types.ObjectId; wrongAttempts: number }[];
            totalCounts: { _id: Types.ObjectId; totalAttempts: number }[];
        }>([
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: "$user" },
            { $match: { "user.role": "USER" } },
            {
                $facet: {
                    wrongCounts: [
                        { $match: { "wrongQuestionIds.0": { $exists: true } } },
                        { $unwind: "$wrongQuestionIds" },
                        { $group: { _id: { sessionId: "$_id", questionId: "$wrongQuestionIds" } } },
                        { $group: { _id: "$_id.questionId", wrongAttempts: { $sum: 1 } } },
                    ],
                    totalCounts: [
                        { $match: { "answeredQuestionIds.0": { $exists: true } } },
                        { $unwind: "$answeredQuestionIds" },
                        { $group: { _id: { sessionId: "$_id", questionId: "$answeredQuestionIds" } } },
                        { $group: { _id: "$_id.questionId", totalAttempts: { $sum: 1 } } },
                    ],
                },
            },
        ]);

        const facetResult = aggregation[0];
        if (!facetResult || facetResult.wrongCounts.length === 0) {
            return [];
        }

        const totalCountsMap = new Map<string, number>();
        for (const item of facetResult.totalCounts) {
            totalCountsMap.set(item._id.toString(), item.totalAttempts);
        }

        interface QuestionStatItem {
            questionIdStr: string;
            questionObjId: Types.ObjectId;
            wrongAttempts: number;
            totalAttempts: number;
            wrongRate: number;
        }

        const statsList: QuestionStatItem[] = [];
        for (const item of facetResult.wrongCounts) {
            const idStr = item._id.toString();
            const total = totalCountsMap.get(idStr) ?? item.wrongAttempts;
            const wrongAttempts = Math.min(item.wrongAttempts, total);
            const wrongRate = total > 0 ? Number(((wrongAttempts / total) * 100).toFixed(1)) : 0;
            statsList.push({
                questionIdStr: idStr,
                questionObjId: item._id,
                wrongAttempts,
                totalAttempts: total,
                wrongRate,
            });
        }

        // Check if there are sufficient questions with at least 3 attempts
        const questionsWithMinAttempts = statsList.filter((q) => q.totalAttempts >= 3);
        const pool = questionsWithMinAttempts.length > 0 ? questionsWithMinAttempts : statsList;

        // Sort by wrongAttempts desc, then wrongRate desc
        pool.sort((a, b) => {
            if (b.wrongAttempts !== a.wrongAttempts) {
                return b.wrongAttempts - a.wrongAttempts;
            }
            return b.wrongRate - a.wrongRate;
        });

        const topQuestions = pool.slice(0, limit);
        if (topQuestions.length === 0) {
            return [];
        }

        const questionIds = topQuestions.map((q) => q.questionObjId);

        // Lookup Questions, LessonAssignments, Lessons, Topics
        const [questions, lessonQuestions] = await Promise.all([
            QuestionModel.find({ _id: { $in: questionIds } }).exec(),
            LessonQuestionModel.find({ questionId: { $in: questionIds } }).exec(),
        ]);

        const questionMap = new Map<string, { content: string; type: string; topicId?: Types.ObjectId }>();
        for (const q of questions) {
            questionMap.set(q._id.toString(), {
                content: q.content,
                type: q.type,
                topicId: q.topicId,
            });
        }

        const lessonIdMap = new Map<string, Types.ObjectId>();
        for (const lq of lessonQuestions) {
            if (!lessonIdMap.has(lq.questionId.toString())) {
                lessonIdMap.set(lq.questionId.toString(), lq.lessonId);
            }
        }

        const lessonIds = Array.from(lessonIdMap.values());
        const topicIds = questions
            .map((q) => q.topicId)
            .filter((t): t is Types.ObjectId => Boolean(t));

        const [lessons, topics] = await Promise.all([
            lessonIds.length > 0 ? LessonModel.find({ _id: { $in: lessonIds } }).exec() : [],
            topicIds.length > 0 ? TopicModel.find({ _id: { $in: topicIds } }).exec() : [],
        ]);

        const lessonNameMap = new Map<string, { name: string; topicId?: Types.ObjectId }>();
        for (const l of lessons) {
            lessonNameMap.set(l._id.toString(), { name: l.name, topicId: l.topicId });
        }

        const topicNameMap = new Map<string, string>();
        for (const t of topics) {
            topicNameMap.set(t._id.toString(), t.name);
        }

        return topQuestions.map((q) => {
            const qDoc = questionMap.get(q.questionIdStr);
            const lessonIdObj = lessonIdMap.get(q.questionIdStr);
            const lessonInfo = lessonIdObj ? lessonNameMap.get(lessonIdObj.toString()) : undefined;

            const topicIdObj = qDoc?.topicId ?? lessonInfo?.topicId;
            const topicIdStr = topicIdObj ? topicIdObj.toString() : "";
            const topicName = topicIdStr ? (topicNameMap.get(topicIdStr) ?? "Chủ đề chưa xác định") : "Chủ đề chưa xác định";

            const wrongRateRounded = Number(q.wrongRate.toFixed(1));
            let difficultyLabel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
            if (wrongRateRounded >= 70) {
                difficultyLabel = "HIGH";
            } else if (wrongRateRounded >= 40) {
                difficultyLabel = "MEDIUM";
            }

            return {
                questionId: q.questionIdStr,
                content: qDoc?.content ?? "Câu hỏi không tồn tại hoặc đã bị xóa",
                questionType: qDoc?.type ?? "UNKNOWN",
                lessonId: lessonIdObj ? lessonIdObj.toString() : "",
                lessonName: lessonInfo?.name ?? "Bài học chưa xác định",
                topicId: topicIdStr,
                topicName,
                wrongAttempts: q.wrongAttempts,
                totalAttempts: q.totalAttempts,
                wrongRate: wrongRateRounded,
                difficultyLabel,
            };
        });
    }

    async getTopLearnedTopics(limit: number): Promise<TopLearnedTopicRaw[]> {
        const results = await LearningSessionModel.aggregate<{
            _id: Types.ObjectId;
            studyCount: number;
            uniqueLearners: number;
            topicName?: string;
        }>([
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: "$user" },
            { $match: { "user.role": "USER" } },
            {
                $lookup: {
                    from: "lessons",
                    localField: "lessonId",
                    foreignField: "_id",
                    as: "lesson",
                },
            },
            { $unwind: "$lesson" },
            { $match: { "lesson.topicId": { $ne: null } } },
            {
                $group: {
                    _id: "$lesson.topicId",
                    studyCount: { $sum: 1 },
                    uniqueLearners: { $addToSet: "$userId" },
                },
            },
            {
                $lookup: {
                    from: "topics",
                    localField: "_id",
                    foreignField: "_id",
                    as: "topic",
                },
            },
            { $unwind: { path: "$topic", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    studyCount: 1,
                    uniqueLearners: { $size: "$uniqueLearners" },
                    topicName: "$topic.name",
                },
            },
            { $sort: { studyCount: -1, uniqueLearners: -1 } },
            { $limit: limit },
        ]);

        return results.map((item) => ({
            topicId: item._id ? item._id.toString() : "",
            topicName: item.topicName ?? "Chủ đề chưa đặt tên",
            studyCount: item.studyCount,
            uniqueLearners: item.uniqueLearners,
        }));
    }

    async getActiveUserStats(limit: number): Promise<ActiveUserStats> {
        const [
            topLearnersDocs,
            topByStreakDocs,
            topByXpDocs,
        ] = await Promise.all([
            UserModel.find({ role: "USER", status: "ACTIVE" })
                .sort({ "stats.lastStudyDate": -1, "stats.currentStreak": -1, "stats.totalXp": -1 })
                .limit(limit)
                .exec(),
            UserModel.find({ role: "USER", status: "ACTIVE" })
                .sort({ "stats.currentStreak": -1, "stats.totalXp": -1 })
                .limit(limit)
                .exec(),
            UserModel.find({ role: "USER", status: "ACTIVE" })
                .sort({ "stats.totalXp": -1, "stats.currentStreak": -1 })
                .limit(limit)
                .exec(),
        ]);

        // Collect all distinct user IDs
        const allUserIds = Array.from(
            new Set([
                ...topLearnersDocs.map((u) => u._id),
                ...topByStreakDocs.map((u) => u._id),
                ...topByXpDocs.map((u) => u._id),
            ]),
        );

        // Count completed lessons for all distinct users
        const completedCounts = allUserIds.length > 0
            ? await UserLessonProgressModel.aggregate<{ _id: Types.ObjectId; count: number }>([
                { $match: { userId: { $in: allUserIds }, status: "COMPLETED" } },
                { $group: { _id: "$userId", count: { $sum: 1 } } },
            ])
            : [];

        const completedMap = new Map<string, number>();
        for (const item of completedCounts) {
            completedMap.set(item._id.toString(), item.count);
        }

        const mapUserToLearner = (u: (typeof topLearnersDocs)[number]): ActiveLearner => ({
            userId: u._id.toString(),
            fullName: u.displayName,
            email: u.email,
            avatarUrl: u.avatarUrl,
            level: u.stats.level ?? 1,
            streak: u.stats.currentStreak ?? 0,
            xp: u.stats.totalXp ?? 0,
            completedLessons: completedMap.get(u._id.toString()) ?? 0,
            lastStudyDate: u.stats.lastStudyDate ? u.stats.lastStudyDate.toISOString() : null,
        });

        return {
            topLearners: topLearnersDocs.map(mapUserToLearner),
            topByStreak: topByStreakDocs.map(mapUserToLearner),
            topByXp: topByXpDocs.map(mapUserToLearner),
        };
    }
}
