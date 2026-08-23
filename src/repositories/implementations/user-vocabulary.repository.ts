import { Types } from "mongoose";
import { UserVocabularyModel, type UserVocabularyDocument } from "../../models/user-vocabulary.model.js";
import type { IUserVocabularyRepository, UserVocabularyGroupedByLesson } from "../interfaces/user-vocabulary.repository.interface.js";

export class UserVocabularyRepository implements IUserVocabularyRepository {
    async upsertLearnedVocabularies(userId: string, vocabularyIds: string[], topicId: string, lessonId: string): Promise<void> {
        if (!userId || !Types.ObjectId.isValid(userId) || !vocabularyIds || vocabularyIds.length === 0 || !topicId || !Types.ObjectId.isValid(topicId) || !lessonId || !Types.ObjectId.isValid(lessonId)) {
            return;
        }

        const validVocabIds = vocabularyIds.filter((id) => id && Types.ObjectId.isValid(id.toString()));
        if (validVocabIds.length === 0) return;

        const now = new Date();
        const userObjectId = new Types.ObjectId(userId);
        const topicObjectId = new Types.ObjectId(topicId);
        const lessonObjectId = new Types.ObjectId(lessonId);

        const ops = validVocabIds.map((vocabId) => {
            const vocabObjectId = new Types.ObjectId(vocabId.toString());
            return {
                updateOne: {
                    filter: {
                        userId: userObjectId,
                        vocabularyId: vocabObjectId,
                    },
                    update: {
                        $set: {
                            topicId: topicObjectId,
                            lessonId: lessonObjectId,
                        },
                        $setOnInsert: {
                            userId: userObjectId,
                            vocabularyId: vocabObjectId,
                            status: "LEARNED" as const,
                            reviewLevel: 0,
                            reviewCount: 0,
                            correctCount: 0,
                            incorrectCount: 0,
                            excludedFromReview: false,
                            learnedAt: now,
                            nextReviewAt: now,
                        },
                    },
                    upsert: true,
                },
            };
        });

        await UserVocabularyModel.bulkWrite(ops as any, { ordered: false });
    }

    async findByUserAndVocabulary(userId: string, vocabularyId: string): Promise<UserVocabularyDocument | null> {
        return UserVocabularyModel.findOne({
            userId: new Types.ObjectId(userId),
            vocabularyId: new Types.ObjectId(vocabularyId),
        }).exec();
    }

    async findByUserIdGroupedByLesson(userId: string): Promise<UserVocabularyGroupedByLesson[]> {
        const pipeline: any[] = [
            { $match: { userId: new Types.ObjectId(userId) } },
            {
                $lookup: {
                    from: "vocabularies",
                    localField: "vocabularyId",
                    foreignField: "_id",
                    as: "vocabulary",
                },
            },
            { $unwind: "$vocabulary" },
            {
                $lookup: {
                    from: "lessons",
                    localField: "lessonId",
                    foreignField: "_id",
                    as: "lesson",
                },
            },
            { $unwind: "$lesson" },
            {
                $group: {
                    _id: "$lessonId",
                    lessonName: { $first: "$lesson.name" },
                    lessonOrder: { $first: "$lesson.orderIndex" },
                    vocabularies: {
                        $push: {
                            _id: "$_id",
                            userId: "$userId",
                            vocabularyId: "$vocabulary",
                            topicId: "$topicId",
                            lessonId: "$lessonId",
                            status: "$status",
                            reviewLevel: "$reviewLevel",
                            reviewCount: "$reviewCount",
                            correctCount: "$correctCount",
                            incorrectCount: "$incorrectCount",
                            excludedFromReview: "$excludedFromReview",
                            learnedAt: "$learnedAt",
                            lastReviewedAt: "$lastReviewedAt",
                            nextReviewAt: "$nextReviewAt",
                            createdAt: "$createdAt",
                            updatedAt: "$updatedAt",
                        },
                    },
                },
            },
            { $sort: { lessonOrder: 1 } },
            {
                $project: {
                    _id: 0,
                    lessonId: "$_id",
                    lessonName: 1,
                    vocabularies: 1,
                },
            },
        ];

        const results = await UserVocabularyModel.aggregate(pipeline).exec();
        
        return results.map(result => ({
            lessonId: result.lessonId.toString(),
            lessonName: result.lessonName,
            vocabularies: result.vocabularies.map((v: any) => ({
                id: v._id.toString(),
                userId: v.userId.toString(),
                vocabularyId: v.vocabularyId._id.toString(),
                topicId: v.topicId.toString(),
                lessonId: v.lessonId.toString(),
                status: v.status,
                reviewLevel: v.reviewLevel,
                reviewCount: v.reviewCount,
                correctCount: v.correctCount,
                incorrectCount: v.incorrectCount,
                excludedFromReview: v.excludedFromReview,
                learnedAt: v.learnedAt,
                lastReviewedAt: v.lastReviewedAt,
                nextReviewAt: v.nextReviewAt,
                vocabulary: {
                    id: v.vocabularyId._id.toString(),
                    word: v.vocabularyId.word,
                    meaning: v.vocabularyId.meaning,
                    phonetic: v.vocabularyId.phonetic,
                    example: v.vocabularyId.example,
                    audioUrl: v.vocabularyId.audioUrl,
                    imageUrl: v.vocabularyId.imageUrl
                }
            }))
        }));
    }

    async findByUserId(userId: string): Promise<UserVocabularyDocument[]> {
        return UserVocabularyModel.find({ userId: new Types.ObjectId(userId) }).exec();
    }

    async findByUserIdWithDetails(userId: string): Promise<UserVocabularyDocument[]> {
        return UserVocabularyModel.find({ userId: new Types.ObjectId(userId) })
            .populate("vocabularyId")
            .exec();
    }

    async findDueForReview(userId: string, query: { limit: number; forceAll?: boolean }): Promise<UserVocabularyDocument[]> {
        const filter: any = {
            userId: new Types.ObjectId(userId),
            status: "LEARNED",
            excludedFromReview: false,
        };

        if (!query.forceAll) {
            filter.nextReviewAt = { $lte: new Date() };
        }

        return UserVocabularyModel.find(filter)
            .sort({ incorrectCount: -1, reviewLevel: 1, nextReviewAt: 1 })
            .limit(query.limit)
            .populate("vocabularyId")
            .exec();
    }

    async updateReviewResult(userId: string, vocabularyId: string, data: Partial<UserVocabularyDocument>): Promise<UserVocabularyDocument | null> {
        return UserVocabularyModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId), vocabularyId: new Types.ObjectId(vocabularyId) },
            { $set: data },
            { new: true }
        ).exec();
    }

    async excludeFromReview(userId: string, vocabularyId: string, exclude: boolean): Promise<UserVocabularyDocument | null> {
        return UserVocabularyModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId), vocabularyId: new Types.ObjectId(vocabularyId) },
            { $set: { excludedFromReview: exclude } },
            { new: true }
        ).exec();
    }

    async countDueByUserId(userId: string): Promise<number> {
        return UserVocabularyModel.countDocuments({
            userId: new Types.ObjectId(userId),
            status: "LEARNED",
            excludedFromReview: false,
            nextReviewAt: { $lte: new Date() },
        }).exec();
    }
}
