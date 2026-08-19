import { AppError } from "../errors/app-error.js";
import type { ILessonRepository } from "../repositories/interfaces/lesson.repository.interface.js";
import type { ISectionRepository } from "../repositories/interfaces/section.repository.interface.js";
import type { ITopicRepository } from "../repositories/interfaces/topic.repository.interface.js";
import type { IUserLessonProgressRepository } from "../repositories/interfaces/user-lesson-progress.repository.interface.js";
import type {
    UserSectionTopicsResponse,
    UserTopicLearningPathResponse,
    UserTopicResponse,
    UserLessonPathItemResponse,
} from "../types/learning-path.types.js";
import type { UserLessonProgressStatus } from "../models/user-lesson-progress.model.js";
import type { LessonDocument } from "../models/lesson.model.js";

export class LearningPathService {
    constructor(
        private readonly sectionRepository: ISectionRepository,
        private readonly topicRepository: ITopicRepository,
        private readonly lessonRepository: ILessonRepository,
        private readonly userLessonProgressRepository: IUserLessonProgressRepository,
    ) {}

    /**
     * Lấy danh sách topic PUBLISHED thuộc một section.
     * Kèm số lượng lesson PUBLISHED của mỗi topic.
     */
    async getPublishedTopicsBySection(
        userId: string,
        sectionId: string,
    ): Promise<UserSectionTopicsResponse> {
        // 1. Kiểm tra section tồn tại và PUBLISHED
        const section = await this.sectionRepository.findById(sectionId);
        if (!section || section.status !== "PUBLISHED") {
            throw new AppError("SECTION_NOT_FOUND", "Không tìm thấy chương học", 404);
        }

        // 2. Lấy tất cả topic PUBLISHED thuộc section, sort orderIndex ASC
        const topics = await this.topicRepository.findPublishedBySectionId(sectionId);

        // 3. Lấy lesson count cho từng topic (batch query)
        const lessonCounts = await Promise.all(
            topics.map((topic) =>
                this.lessonRepository
                    .findPublishedByTopicId(topic._id.toString())
                    .then((lessons) => lessons.length),
            ),
        );

        // 4. Map sang DTO user
        const topicResponses: UserTopicResponse[] = topics.map((topic, index) => ({
            id: topic._id.toString(),
            sectionId: topic.sectionId.toString(),
            name: topic.name,
            description: topic.description ?? null,
            orderIndex: topic.orderIndex,
            lessonCount: lessonCounts[index] ?? 0,
        }));

        return { topics: topicResponses };
    }

    /**
     * Lấy lộ trình học của một topic: danh sách lesson PUBLISHED với trạng thái mở khóa.
     * Quy tắc unlock:
     *   - Lesson đầu tiên: UNLOCKED nếu chưa có progress
     *   - Lesson tiếp theo: UNLOCKED chỉ khi lesson trước COMPLETED
     *   - Nếu đã có progress: dùng status từ progress
     */
    async getTopicLearningPath(
        userId: string,
        topicId: string,
    ): Promise<UserTopicLearningPathResponse> {
        // 1. Kiểm tra topic tồn tại và PUBLISHED
        const topic = await this.topicRepository.findById(topicId);
        if (!topic || topic.status !== "PUBLISHED") {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }

        // 2. Lấy lesson PUBLISHED theo orderIndex ASC
        const lessons = await this.lessonRepository.findPublishedByTopicId(topicId);

        // 3. Lấy toàn bộ progress trong một query (tránh N+1)
        const lessonIds = lessons.map((l) => l._id.toString());
        const progressList = lessonIds.length > 0
            ? await this.userLessonProgressRepository.findByUserIdAndLessonIds(userId, lessonIds)
            : [];

        // Tạo map lessonId -> progress để lookup O(1)
        const progressMap = new Map(
            progressList.map((p) => [p.lessonId.toString(), p]),
        );

        // 4. Tính progressStatus cho từng lesson (không tạo document mới)
        const lessonResponses: UserLessonPathItemResponse[] = this.computeLessonStatuses(
            lessons,
            progressMap,
        );

        return {
            topic: {
                id: topic._id.toString(),
                name: topic.name,
                description: topic.description ?? null,
            },
            lessons: lessonResponses,
        };
    }

    /**
     * Tính trạng thái hiển thị từng lesson theo quy tắc unlock.
     * Không tạo UserLessonProgress mới — chỉ tính động để hiển thị.
     */
    private computeLessonStatuses(
        lessons: LessonDocument[],
        progressMap: Map<string, { status: UserLessonProgressStatus; bestScore: number; totalAttempts: number }>,
    ): UserLessonPathItemResponse[] {
        const result: UserLessonPathItemResponse[] = [];

        for (let i = 0; i < lessons.length; i++) {
            const lesson = lessons[i]!;
            const lessonId = lesson._id.toString();
            const progress = progressMap.get(lessonId);

            let progressStatus: UserLessonProgressStatus;

            if (progress) {
                // Nếu đã có progress, dùng status từ DB
                progressStatus = progress.status;
            } else {
                // Chưa có progress: tính động
                if (i === 0) {
                    // Lesson đầu tiên luôn UNLOCKED nếu chưa có progress
                    progressStatus = "UNLOCKED";
                } else {
                    // Lesson tiếp theo: UNLOCKED khi lesson trước COMPLETED
                    const prevLessonId = lessons[i - 1]!._id.toString();
                    const prevProgress = progressMap.get(prevLessonId);
                    progressStatus = prevProgress?.status === "COMPLETED" ? "UNLOCKED" : "LOCKED";
                }
            }

            const isLocked = progressStatus === "LOCKED";

            result.push({
                id: lessonId,
                name: lesson.name,
                description: lesson.description ?? null,
                orderIndex: lesson.orderIndex,
                requiredScore: lesson.requiredScore,
                questionCount: lesson.questionCount,
                xpReward: lesson.xpReward,
                diamondReward: lesson.diamondReward,
                progressStatus,
                isLocked,
                bestScore: progress?.bestScore ?? 0,
                totalAttempts: progress?.totalAttempts ?? 0,
            });
        }

        return result;
    }
}
