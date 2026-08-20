import { LessonModel, type LessonDocument } from "../../models/lesson.model.js";
import {
    type CreateLessonInput,
    type LessonStatus,
    type UpdateLessonInput,
} from "../../types/lesson.types.js";
import { type ILessonRepository } from "../interfaces/lesson.repository.interface.js";

export class LessonRepository implements ILessonRepository {
    public async findById(id: string): Promise<LessonDocument | null> {
        return LessonModel.findById(id).exec();
    }

    public async findByTopicId(topicId: string): Promise<LessonDocument[]> {
        return LessonModel.find({ topicId })
            .sort({ orderIndex: 1, createdAt: 1, _id: 1 })
            .exec();
    }

    public async findPublishedByTopicId(topicId: string): Promise<LessonDocument[]> {
        return LessonModel.find({ topicId, status: "PUBLISHED" })
            .sort({ orderIndex: 1, createdAt: 1, _id: 1 })
            .exec();
    }

    public async findPublishedByTopicIds(topicIds: string[]): Promise<LessonDocument[]> {
        if (topicIds.length === 0) return [];

        return LessonModel.find({
            topicId: { $in: topicIds },
            status: "PUBLISHED",
        })
            .sort({ orderIndex: 1, createdAt: 1, _id: 1 })
            .exec();
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
            questionCount: data.questionCount ?? 10,
            xpReward: data.xpReward ?? 0,
            diamondReward: data.diamondReward ?? 0,
            status: data.status ?? "DRAFT",
        });
    }

    public async update(
        id: string,
        data: UpdateLessonInput,
    ): Promise<LessonDocument | null> {
        return LessonModel.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true },
        ).exec();
    }

    public async updateStatus(
        id: string,
        status: LessonStatus,
    ): Promise<LessonDocument | null> {
        return LessonModel.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true, runValidators: true },
        ).exec();
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
}
