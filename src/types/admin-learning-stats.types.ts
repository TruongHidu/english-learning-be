export interface UserSummary {
    totalUsers: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    activeUsers: number;
    blockedUsers: number;
    activeToday: number;
    activeLast7Days: number;
    activeLast30Days: number;
}

export interface LessonSummary {
    completedLessons: number;
    completedSessions: number;
    inProgressLessons: number;
    passedSessions: number;
    passedRate: number;
    averageScore: number;
}

export type QuestionDifficultyLabel = "LOW" | "MEDIUM" | "HIGH";

export interface TopWrongQuestion {
    questionId: string;
    content: string;
    questionType: string;
    lessonId: string;
    lessonName: string;
    topicId: string;
    topicName: string;
    wrongAttempts: number;
    totalAttempts: number;
    wrongRate: number;
    difficultyLabel: QuestionDifficultyLabel;
}

export interface TopLearnedTopic {
    topicId: string;
    topicName: string;
    studyCount: number;
    uniqueLearners: number;
    percentage: number;
}

export interface ActiveLearner {
    userId: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
    level: number;
    streak: number;
    xp: number;
    completedLessons: number;
    lastStudyDate: string | null;
}

export interface ActiveUserStats {
    topLearners: ActiveLearner[];
    topByStreak: ActiveLearner[];
    topByXp: ActiveLearner[];
}

export interface AdminLearningStatsResponse {
    userSummary: UserSummary;
    lessonSummary: LessonSummary;
    topWrongQuestions: TopWrongQuestion[];
    topLearnedTopics: TopLearnedTopic[];
    activeUserStats: ActiveUserStats;
    generatedAt: string;
}
