import { Types } from "mongoose";
import { UserVocabularyModel, type UserVocabularyDocument } from "../../models/user-vocabulary.model.js";
import type { IUserVocabularyRepository } from "../interfaces/user-vocabulary.repository.interface.js";

export class UserVocabularyRepository implements IUserVocabularyRepository {
    async upsertLearnedVocabularies(userId: string, vocabularyIds: string[]): Promise<void> {
        if (!userId || !Types.ObjectId.isValid(userId) || !vocabularyIds || vocabularyIds.length === 0) {
            return;
        }

        const validVocabIds = vocabularyIds.filter((id) => id && Types.ObjectId.isValid(id.toString()));
        if (validVocabIds.length === 0) return;

        const now = new Date();
        const userObjectId = new Types.ObjectId(userId);

        const ops = validVocabIds.map((vocabId) => {
            const vocabObjectId = new Types.ObjectId(vocabId.toString());
            return {
                updateOne: {
                    filter: {
                        userId: userObjectId,
                        vocabularyId: vocabObjectId,
                    },
                    update: {
                        $setOnInsert: {
                            userId: userObjectId,
                            vocabularyId: vocabObjectId,
                            masteryLevel: 1,
                            learnedAt: now,
                        },
                        $inc: { reviewCount: 1 },
                        $set: { lastReviewedAt: now },
                    },
                    upsert: true,
                },
            };
        });

        await UserVocabularyModel.bulkWrite(ops, { ordered: false });
    }

    async findByUserId(userId: string): Promise<UserVocabularyDocument[]> {
        return UserVocabularyModel.find({ userId: new Types.ObjectId(userId) }).exec();
    }

    async findByUserIdWithDetails(userId: string): Promise<UserVocabularyDocument[]> {
        return UserVocabularyModel.find({ userId: new Types.ObjectId(userId) })
            .populate("vocabularyId")
            .sort({ lastReviewedAt: -1 })
            .exec();
    }

    async countByUserId(userId: string): Promise<number> {
        return UserVocabularyModel.countDocuments({ userId: new Types.ObjectId(userId) }).exec();
    }
}

