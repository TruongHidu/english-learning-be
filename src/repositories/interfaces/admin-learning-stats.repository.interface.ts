import type {
    ActiveUserStats,
    TopWrongQuestion,
    UserSummary,
} from "../../types/admin-learning-stats.types.js";

export interface LessonSummaryRaw {
    completedLessons: number;
    completedSessions: number;
    inProgressLessons: number;
    passedSessions: number;
    averageScore: number;
}

export interface TopLearnedTopicRaw {
    topicId: string;
    topicName: string;
    studyCount: number;
    uniqueLearners: number;
}

export interface IAdminLearningStatsRepository {
    getUserSummary(now: Date): Promise<UserSummary>;
    getLessonSummary(): Promise<LessonSummaryRaw>;
    getTopWrongQuestions(limit: number): Promise<TopWrongQuestion[]>;
    getTopLearnedTopics(limit: number): Promise<TopLearnedTopicRaw[]>;
    getActiveUserStats(limit: number): Promise<ActiveUserStats>;
}
