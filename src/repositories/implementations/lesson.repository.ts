import { readLessonCounts, changeLessonContent } from "../../services/lesson-content.service.js";
import { LessonModel, type LessonDocument } from "../../models/lesson.model.js";
import {
    type CreateLessonInput,
    type LessonStatus,
    type UpdateLessonInput,
} from "../../types/lesson.types.js";
import { type ILessonRepository } from "../interfaces/lesson.repository.interface.js";

export class LessonRepository implements ILessonRepository {
    private async withCounts(lessons: LessonDocument[]): Promise<void> {
        if (!lessons.length) return;
        const counts = await readLessonCounts(lessons.map(lesson => lesson._id.toString()));
        for (const lesson of lessons) {
            const count = counts.get(lesson._id.toString())!;
            lesson.questionCount = count.assigned;
            lesson.publishedQuestionCount = count.published;
        }
    }
    public async findById(id: string): Promise<LessonDocument | null> {
        const lesson = await LessonModel.findById(id).exec();
        if (lesson) await this.withCounts([lesson]);
        return lesson;
    }

    public async findByTopicId(topicId: string): Promise<LessonDocument[]> {
        const lessons = await LessonModel.find({ topicId })
            .sort({ orderIndex: 1, createdAt: 1, _id: 1 })
            .exec();
        await this.withCounts(lessons);
        return lessons;
    }

    public async findPublishedByTopicId(topicId: string): Promise<LessonDocument[]> {
        const lessons = await LessonModel.find({ topicId, status: "PUBLISHED" })
            .sort({ orderIndex: 1, createdAt: 1, _id: 1 })
            .exec();
        await this.withCounts(lessons);
        return lessons;
    }

    public async findPublishedByTopicIds(topicIds: string[]): Promise<LessonDocument[]> {
        if (topicIds.length === 0) return [];

        const lessons = await LessonModel.find({
            topicId: { $in: topicIds },
            status: "PUBLISHED",
        })
            .sort({ orderIndex: 1, createdAt: 1, _id: 1 })
            .exec();
        await this.withCounts(lessons);
        return lessons;
    }

    public async findByNameAndTopicId(
        name: string,
        topicId: string,
    ): Promise<LessonDocument | null> {
        // Case-insensitive exact match
        return LessonModel.findOne({
            topicId,
            name: { $regex: new RegExp(`^${name}$`, "i") },
        }).exec();
    }

    public async create(
        topicId: string,
        data: CreateLessonInput,
    ): Promise<LessonDocument> {
        return LessonModel.create({
            topicId,
            name: data.name,
            description: data.description,
            orderIndex: data.orderIndex ?? 0,
            requiredScore: data.requiredScore ?? 70,
            questionCount: 0,
            xpReward: data.xpReward ?? 0,
            diamondReward: data.diamondReward ?? 0,
            status: data.status ?? "DRAFT",
        });
    }

    public async update(
        id: string,
        data: UpdateLessonInput,
    ): Promise<LessonDocument | null> {
        await changeLessonContent(async () => [id], async () => LessonModel.findByIdAndUpdate(
            id,
            { $set: data },
            { returnDocument: "after", runValidators: true },
        ).exec());
        return this.findById(id);
    }

    public async updateStatus(
        id: string,
        status: LessonStatus,
    ): Promise<LessonDocument | null> {
        await changeLessonContent(async () => [id], async () => LessonModel.findByIdAndUpdate(
            id,
            { $set: { status } },
            { returnDocument: "after", runValidators: true },
        ).exec());
        return this.findById(id);
    }

    public async deleteById(id: string): Promise<void> {
        await LessonModel.findByIdAndDelete(id).exec();
    }

    public async getMaxOrderIndex(topicId: string): Promise<number> {
        const result = await LessonModel.findOne({ topicId })
            .sort({ orderIndex: -1 })
            .select("orderIndex")
            .exec();
        
        return result?.orderIndex ?? -1;
    }

    public async reorder(topicId: string, lessonIds: string[]): Promise<void> {
        const bulkOps = lessonIds.map((id, index) => ({
            updateOne: {
                filter: { _id: id, topicId },
                update: { $set: { orderIndex: index } },
            },
        }));

        if (bulkOps.length > 0) {
            await LessonModel.bulkWrite(bulkOps);
        }
    }

    public async countByTopicId(topicId: string): Promise<number> {
        return LessonModel.countDocuments({ topicId }).exec();
    }

    public async findNextLesson(topicId: string, currentOrderIndex: number): Promise<LessonDocument | null> {
        return LessonModel.findOne({
            topicId,
            status: "PUBLISHED",
            orderIndex: { $gt: currentOrderIndex }
        })
        .sort({ orderIndex: 1 })
        .exec();
    }
}
