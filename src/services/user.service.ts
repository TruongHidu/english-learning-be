import { AppError } from "../errors/app-error.js";
import { UserMapper } from "../mappers/user.mapper.js";
import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";
import type { IPasswordHasher } from "../security/password-hasher.interface.js";
import type {
    ChangePasswordInput,
    UpdatedUserNameResponse,
    UpdateDisplayNameInput,
    UserProfileResponse,
} from "../types/user.types.js";

import { Types } from "mongoose";
import { UserLessonProgressModel } from "../models/user-lesson-progress.model.js";
import { LessonModel } from "../models/lesson.model.js";
import { VocabularyModel } from "../models/vocabulary.model.js";
import { SectionModel } from "../models/section.model.js";
import { TopicModel } from "../models/topic.model.js";
import { LessonQuestionModel } from "../models/lesson-question.model.js";
import { QuestionModel } from "../models/question.model.js";
import type { IUserVocabularyRepository } from "../repositories/interfaces/user-vocabulary.repository.interface.js";
import type { HeartService } from "./heart.service.js";

export class UserService {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly passwordHasher: IPasswordHasher,
        private readonly heartService: HeartService,
        private readonly userVocabularyRepository: IUserVocabularyRepository,
    ) {}

    async getProfile(userId: string): Promise<UserProfileResponse> {
        const user = await this.heartService.syncUserHearts(userId);

        if (!user) {
            throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
        }

        return UserMapper.toProfileResponse(user);
    }

    async updateDisplayName(
        userId: string,
        input: UpdateDisplayNameInput,
    ): Promise<UpdatedUserNameResponse> {
        const user = await this.userRepository.updateDisplayName(
            userId,
            input.displayName.trim(),
        );

        if (!user) {
            throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
        }

        return UserMapper.toUpdatedNameResponse(user);
    }

    async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
        }

        if (user.authProvider !== "LOCAL" || !user.passwordHash) {
            throw new AppError(
                "PASSWORD_CHANGE_NOT_AVAILABLE",
                "Tài khoản này không hỗ trợ đổi mật khẩu",
                400,
            );
        }

        const isCurrentPasswordCorrect = await this.passwordHasher.compare(
            input.currentPassword,
            user.passwordHash,
        );

        if (!isCurrentPasswordCorrect) {
            throw new AppError(
                "CURRENT_PASSWORD_INCORRECT",
                "Mật khẩu hiện tại không chính xác",
                400,
            );
        }

        if (input.newPassword === input.currentPassword) {
            throw new AppError(
                "NEW_PASSWORD_SAME_AS_CURRENT",
                "Mật khẩu mới không được giống mật khẩu hiện tại",
                400,
            );
        }

        const newPasswordHash = await this.passwordHasher.hash(input.newPassword);
        await this.userRepository.updatePassword(userId, newPasswordHash);
    }

    async getLearnedVocabularies(userId: string) {
        let list = await this.userVocabularyRepository.findByUserIdWithDetails(userId);

        if (list.length === 0) {
            await this.syncVocabulariesFromCompletedLessons(userId);
            list = await this.userVocabularyRepository.findByUserIdWithDetails(userId);
        }

        return list.map((doc) => {
            const vocab = doc.vocabularyId as any;
            return {
                id: doc._id.toString(),
                vocabularyId: vocab?._id ? vocab._id.toString() : null,
                word: vocab?.word ?? "",
                meaning: vocab?.meaning ?? "",
                phonetic: vocab?.phonetic ?? null,
                partOfSpeech: vocab?.partOfSpeech ?? null,
                example: vocab?.example ?? null,
                exampleMeaning: vocab?.exampleMeaning ?? null,
                audioUrl: vocab?.audioUrl ?? null,
                imageUrl: vocab?.imageUrl ?? null,
                difficulty: vocab?.difficulty ?? "EASY",
                masteryLevel: doc.reviewLevel,
                reviewCount: doc.reviewCount,
                learnedAt: doc.learnedAt,
                lastReviewedAt: doc.lastReviewedAt,
            };
        });
    }

    private async syncVocabulariesFromCompletedLessons(userId: string): Promise<void> {
        try {
            const userObjId = new Types.ObjectId(userId);
            const completedProgresses = await UserLessonProgressModel.find({
                userId: userObjId,
                status: "COMPLETED",
            }).exec();

            if (completedProgresses.length === 0) return;

            const lessonIds = completedProgresses.map((p) => p.lessonId);
            
            // Find all questions in these lessons
            const lessonQuestions = await LessonQuestionModel.find({ lessonId: { $in: lessonIds } }).exec();
            const questionIds = lessonQuestions.map(lq => lq.questionId);
            
            // Find vocabularies related to these questions
            const questions = await QuestionModel.find({ _id: { $in: questionIds }, status: "PUBLISHED" }).exec();
            
            const vocabLessonMap = new Map<string, { topicId: string, lessonId: string }>();
            
            for (const q of questions) {
                const lessonId = lessonQuestions.find(lq => lq.questionId.equals(q._id))?.lessonId.toString();
                if (!lessonId) continue;
                
                if (q.vocabularyId) {
                    vocabLessonMap.set(q.vocabularyId.toString(), { topicId: "", lessonId });
                }
                if (q.vocabularyIds) {
                    for (const vId of q.vocabularyIds) {
                        vocabLessonMap.set(vId.toString(), { topicId: "", lessonId });
                    }
                }
                if (q.matchingPairs) {
                    for (const pair of q.matchingPairs) {
                        if (pair.vocabularyId) {
                            vocabLessonMap.set(pair.vocabularyId.toString(), { topicId: "", lessonId });
                        }
                    }
                }
            }
            
            if (vocabLessonMap.size === 0) return;
            
            const vocabIds = Array.from(vocabLessonMap.keys());
            const vocabObjects = await VocabularyModel.find({ _id: { $in: vocabIds } }).exec();
            
            for (const v of vocabObjects) {
                const mapData = vocabLessonMap.get(v._id.toString());
                if (mapData) {
                    mapData.topicId = v.topicId.toString();
                }
            }

            // Group by topicId, lessonId to use the repository method efficiently
            const ops = [];
            for (const v of vocabObjects) {
                const mapData = vocabLessonMap.get(v._id.toString());
                if (mapData && mapData.topicId && mapData.lessonId) {
                    ops.push({
                        updateOne: {
                            filter: {
                                userId: userObjId,
                                vocabularyId: v._id,
                            },
                            update: {
                                $set: {
                                    topicId: new Types.ObjectId(mapData.topicId),
                                    lessonId: new Types.ObjectId(mapData.lessonId),
                                },
                                $setOnInsert: {
                                    userId: userObjId,
                                    vocabularyId: v._id,
                                    status: "LEARNED" as const,
                                    reviewLevel: 0,
                                    reviewCount: 0,
                                    correctCount: 0,
                                    incorrectCount: 0,
                                    excludedFromReview: false,
                                    learnedAt: new Date(),
                                    nextReviewAt: new Date(),
                                },
                            },
                            upsert: true,
                        }
                    });
                }
            }

            if (ops.length > 0) {
                const { UserVocabularyModel } = await import("../models/user-vocabulary.model.js");
                await UserVocabularyModel.bulkWrite(ops as any, { ordered: false });
            }
        } catch (err) {
            console.error("Error auto-syncing vocabularies for completed lessons:", err);
        }
    }

    async getVocabulariesGroupedBySections(userId: string) {
        await this.syncVocabulariesFromCompletedLessons(userId);

        const userVocabs = await this.userVocabularyRepository.findByUserId(userId);
        const userVocabMap = new Map<string, { masteryLevel: number; reviewCount: number; lastReviewedAt: Date | null }>();
        for (const uv of userVocabs) {
            userVocabMap.set(uv.vocabularyId.toString(), {
                masteryLevel: uv.reviewLevel,
                reviewCount: uv.reviewCount,
                lastReviewedAt: uv.lastReviewedAt,
            });
        }

        const sections = await SectionModel.find({ status: "PUBLISHED" }).sort({ orderIndex: 1 }).exec();
        const sectionIds = sections.map((s) => s._id);

        const topics = await TopicModel.find({ sectionId: { $in: sectionIds }, status: "PUBLISHED" }).sort({ orderIndex: 1 }).exec();
        const topicIds = topics.map((t) => t._id);

        const vocabularies = await VocabularyModel.find({ topicId: { $in: topicIds }, status: "PUBLISHED" }).exec();

        const vocabsByTopic = new Map<string, any[]>();
        for (const v of vocabularies) {
            const tId = v.topicId.toString();
            const userLearned = userVocabMap.get(v._id.toString());
            const item = {
                id: v._id.toString(),
                vocabularyId: v._id.toString(),
                word: v.word,
                meaning: v.meaning,
                phonetic: v.phonetic ?? null,
                partOfSpeech: v.partOfSpeech ?? null,
                example: v.example ?? null,
                exampleMeaning: v.exampleMeaning ?? null,
                audioUrl: v.audioUrl ?? null,
                imageUrl: v.imageUrl ?? null,
                difficulty: v.difficulty ?? "EASY",
                isLearned: !!userLearned,
                masteryLevel: userLearned?.masteryLevel ?? 0,
                reviewCount: userLearned?.reviewCount ?? 0,
                lastReviewedAt: userLearned?.lastReviewedAt ?? null,
            };
            if (!vocabsByTopic.has(tId)) vocabsByTopic.set(tId, []);
            vocabsByTopic.get(tId)!.push(item);
        }

        const topicsBySection = new Map<string, any[]>();
        for (const t of topics) {
            const sId = t.sectionId.toString();
            const topicVocabsList = vocabsByTopic.get(t._id.toString()) ?? [];
            const learnedCount = topicVocabsList.filter((v) => v.isLearned).length;
            const topicGroup = {
                topicId: t._id.toString(),
                topicName: t.name,
                description: t.description ?? null,
                totalVocabularies: topicVocabsList.length,
                learnedCount,
                unlearnedCount: topicVocabsList.length - learnedCount,
                vocabularies: topicVocabsList,
            };
            if (!topicsBySection.has(sId)) topicsBySection.set(sId, []);
            topicsBySection.get(sId)!.push(topicGroup);
        }

        return sections.map((s) => {
            const topicList = topicsBySection.get(s._id.toString()) ?? [];
            const totalVocabularies = topicList.reduce((acc, t) => acc + t.totalVocabularies, 0);
            const learnedCount = topicList.reduce((acc, t) => acc + t.learnedCount, 0);
            return {
                sectionId: s._id.toString(),
                sectionName: s.name,
                description: s.description ?? null,
                orderIndex: s.orderIndex,
                totalVocabularies,
                learnedCount,
                unlearnedCount: totalVocabularies - learnedCount,
                topics: topicList,
            };
        });
    }

    private formatVocabularyItems(
        vocabularies: any[],
        userVocabMap: Map<string, { masteryLevel: number; reviewCount: number; lastReviewedAt: Date | null }>
    ) {
        return vocabularies.map((v) => {
            const userLearned = userVocabMap.get(v._id.toString());
            return {
                id: v._id.toString(),
                vocabularyId: v._id.toString(),
                word: v.word,
                meaning: v.meaning,
                phonetic: v.phonetic ?? null,
                partOfSpeech: v.partOfSpeech ?? null,
                example: v.example ?? null,
                exampleMeaning: v.exampleMeaning ?? null,
                audioUrl: v.audioUrl ?? null,
                imageUrl: v.imageUrl ?? null,
                difficulty: v.difficulty ?? "EASY",
                isLearned: !!userLearned,
                masteryLevel: userLearned?.masteryLevel ?? 0,
                reviewCount: userLearned?.reviewCount ?? 0,
                lastReviewedAt: userLearned?.lastReviewedAt ?? null,
            };
        });
    }

    async getVocabulariesByTopic(userId: string, topicId: string) {
        await this.syncVocabulariesFromCompletedLessons(userId);

        const topicObjId = new Types.ObjectId(topicId);
        const topic = await TopicModel.findById(topicObjId).exec();
        if (!topic) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }

        const userVocabs = await this.userVocabularyRepository.findByUserId(userId);
        const userVocabMap = new Map<string, { masteryLevel: number; reviewCount: number; lastReviewedAt: Date | null }>();
        for (const uv of userVocabs) {
            userVocabMap.set(uv.vocabularyId.toString(), {
                masteryLevel: uv.reviewLevel,
                reviewCount: uv.reviewCount,
                lastReviewedAt: uv.lastReviewedAt,
            });
        }

        const vocabularies = await VocabularyModel.find({ topicId: topicObjId, status: "PUBLISHED" }).exec();
        const items = this.formatVocabularyItems(vocabularies, userVocabMap);
        const learnedCount = items.filter((i) => i.isLearned).length;

        return {
            topicId: topic._id.toString(),
            topicName: topic.name,
            description: topic.description ?? null,
            totalVocabularies: items.length,
            learnedCount,
            unlearnedCount: items.length - learnedCount,
            vocabularies: items,
        };
    }

    async getVocabulariesByLesson(userId: string, lessonId: string) {
        await this.syncVocabulariesFromCompletedLessons(userId);

        const lessonObjId = new Types.ObjectId(lessonId);
        const lesson = await LessonModel.findById(lessonObjId).exec();
        if (!lesson) {
            throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy bài học", 404);
        }

        const assignments = await LessonQuestionModel.find({ lessonId: lessonObjId }).exec();
        const questionIds = assignments.map((a) => a.questionId);
        const questions = await QuestionModel.find({ _id: { $in: questionIds }, status: "PUBLISHED" }).exec();

        const vocabIdSet = new Set<string>();
        for (const q of questions) {
            if (q.vocabularyId) {
                vocabIdSet.add(q.vocabularyId.toString());
            }
            if (q.vocabularyIds && q.vocabularyIds.length > 0) {
                for (const vId of q.vocabularyIds) {
                    vocabIdSet.add(vId.toString());
                }
            }
            if (q.matchingPairs && q.matchingPairs.length > 0) {
                for (const pair of q.matchingPairs) {
                    if (pair.vocabularyId) {
                        vocabIdSet.add(pair.vocabularyId.toString());
                    }
                }
            }
        }

        let vocabularies: any[] = [];
        if (vocabIdSet.size > 0) {
            const validObjIds = Array.from(vocabIdSet)
                .filter((id) => Types.ObjectId.isValid(id))
                .map((id) => new Types.ObjectId(id));
            vocabularies = await VocabularyModel.find({ _id: { $in: validObjIds }, status: "PUBLISHED" }).exec();
        } else {
            vocabularies = await VocabularyModel.find({ topicId: lesson.topicId, status: "PUBLISHED" }).exec();
        }

        const userVocabs = await this.userVocabularyRepository.findByUserId(userId);
        const userVocabMap = new Map<string, { masteryLevel: number; reviewCount: number; lastReviewedAt: Date | null }>();
        for (const uv of userVocabs) {
            userVocabMap.set(uv.vocabularyId.toString(), {
                masteryLevel: uv.reviewLevel,
                reviewCount: uv.reviewCount,
                lastReviewedAt: uv.lastReviewedAt,
            });
        }

        const items = this.formatVocabularyItems(vocabularies, userVocabMap);
        const learnedCount = items.filter((i) => i.isLearned).length;

        return {
            lessonId: lesson._id.toString(),
            lessonName: lesson.name,
            totalVocabularies: items.length,
            learnedCount,
            unlearnedCount: items.length - learnedCount,
            vocabularies: items,
        };
    }
}





