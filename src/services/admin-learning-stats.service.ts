import type { IAdminLearningStatsRepository } from "../repositories/interfaces/admin-learning-stats.repository.interface.js";
import type {
    AdminLearningStatsResponse,
    LessonSummary,
    TopLearnedTopic,
} from "../types/admin-learning-stats.types.js";

export interface AnalyticsQueryOptions {
    wrongQuestionLimit?: number;
    topicLimit?: number;
    learnerLimit?: number;
}

export class AdminLearningStatsService {
    constructor(
        private readonly statsRepository: IAdminLearningStatsRepository,
        private readonly nowSupplier: () => Date = () => new Date(),
    ) {}

    async getAnalytics(options: AnalyticsQueryOptions = {}): Promise<AdminLearningStatsResponse> {
        const wrongQuestionLimit = options.wrongQuestionLimit ?? 10;
        const topicLimit = options.topicLimit ?? 5;
        const learnerLimit = options.learnerLimit ?? 10;

        const now = this.nowSupplier();

        const [
            userSummary,
            lessonRaw,
            topWrongQuestions,
            topTopicsRaw,
            activeUserStats,
        ] = await Promise.all([
            this.statsRepository.getUserSummary(now),
            this.statsRepository.getLessonSummary(),
            this.statsRepository.getTopWrongQuestions(wrongQuestionLimit),
            this.statsRepository.getTopLearnedTopics(topicLimit),
            this.statsRepository.getActiveUserStats(learnerLimit),
        ]);

        const passedRate = lessonRaw.completedSessions === 0
            ? 0
            : Number(((lessonRaw.passedSessions / lessonRaw.completedSessions) * 100).toFixed(1));

        const averageScore = Number((lessonRaw.averageScore || 0).toFixed(1));

        const lessonSummary: LessonSummary = {
            completedLessons: lessonRaw.completedLessons,
            completedSessions: lessonRaw.completedSessions,
            inProgressLessons: lessonRaw.inProgressLessons,
            passedSessions: lessonRaw.passedSessions,
            passedRate: isNaN(passedRate) ? 0 : passedRate,
            averageScore: isNaN(averageScore) ? 0 : averageScore,
        };

        const maxTopicStudyCount = topTopicsRaw.length > 0 ? (topTopicsRaw[0]?.studyCount ?? 0) : 0;

        const topLearnedTopics: TopLearnedTopic[] = topTopicsRaw.map((topic) => {
            const percentage = maxTopicStudyCount === 0
                ? 0
                : Number(((topic.studyCount / maxTopicStudyCount) * 100).toFixed(1));

            return {
                topicId: topic.topicId,
                topicName: topic.topicName,
                studyCount: topic.studyCount,
                uniqueLearners: topic.uniqueLearners,
                percentage: isNaN(percentage) ? 0 : percentage,
            };
        });

        return {
            userSummary,
            lessonSummary,
            topWrongQuestions,
            topLearnedTopics,
            activeUserStats,
            generatedAt: now.toISOString(),
        };
    }
}
