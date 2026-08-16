import {
    LessonQuestionModel,
    type LessonQuestionDocument,
} from "../../models/lesson-question.model.js";
import type { ILessonQuestionRepository } from "../interfaces/lesson-question.repository.interface.js";

export class LessonQuestionRepository implements ILessonQuestionRepository {
    public async findByLessonId(lessonId: string): Promise<LessonQuestionDocument[]> {
        return LessonQuestionModel.find({ lessonId }).sort({ orderIndex: 1 }).exec();
    }

    public async findByLessonIdAndQuestionId(
        lessonId: string,
        questionId: string,
    ): Promise<LessonQuestionDocument | null> {
        return LessonQuestionModel.findOne({ lessonId, questionId }).exec();
    }

    public async createMany(
        lessonId: string,
        questionIds: string[],
    ): Promise<LessonQuestionDocument[]> {
        const lastItem = await LessonQuestionModel.findOne({ lessonId })
            .sort({ orderIndex: -1 })
            .select("orderIndex")
            .exec();

        let currentOrder = lastItem ? lastItem.orderIndex : 0;

        const docsToInsert = questionIds.map((qId) => {
            currentOrder += 1;
            return {
                lessonId,
                questionId: qId,
                orderIndex: currentOrder,
            };
        });

        return LessonQuestionModel.insertMany(docsToInsert) as unknown as Promise<
            LessonQuestionDocument[]
        >;
    }

    public async deleteByLessonIdAndQuestionId(
        lessonId: string,
        questionId: string,
    ): Promise<void> {
        await LessonQuestionModel.deleteOne({ lessonId, questionId }).exec();
    }

    public async reorder(lessonId: string, questionIds: string[]): Promise<void> {
        const bulkOps = questionIds.map((qId, index) => ({
            updateOne: {
                filter: { lessonId, questionId: qId },
                update: { $set: { orderIndex: index + 1 } },
            },
        }));

        if (bulkOps.length > 0) {
            await LessonQuestionModel.bulkWrite(bulkOps);
        }
    }

    public async countByLessonId(lessonId: string): Promise<number> {
        return LessonQuestionModel.countDocuments({ lessonId }).exec();
    }

    public async countByQuestionId(questionId: string): Promise<number> {
        return LessonQuestionModel.countDocuments({ questionId }).exec();
    }
}
