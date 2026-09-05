import mongoose, { Types, type ClientSession } from "mongoose";

import { AppError } from "../../errors/app-error.js";
import { AIGenerationModel } from "../../models/ai-generation.model.js";
import { QuestionModel, type QuestionDocument } from "../../models/question.model.js";
import {
    buildQuestionDedupeKey,
    normalizeQuestionContent,
} from "../../utils/question-normalization.utils.js";
import type {
    AiQuestionCommitItem,
    CommitAiQuestionGenerationData,
    CommitAiQuestionGenerationResult,
    IAiQuestionCommitRepository,
} from "../interfaces/ai-question-commit.repository.interface.js";

interface MongoErrorLike {
    code?: number;
}

const isDuplicateKeyError = (error: unknown): error is MongoErrorLike =>
    typeof error === "object" && error !== null && "code" in error && error.code === 11000;

export class AiQuestionCommitRepository implements IAiQuestionCommitRepository {
    async commit(
        data: CommitAiQuestionGenerationData,
    ): Promise<CommitAiQuestionGenerationResult> {
        const existingCommit = await this.findCommittedResult(data);
        if (existingCommit) return existingCommit;

        const session = await mongoose.startSession();
        let transactionResult: CommitAiQuestionGenerationResult | null = null;
        try {
            await session.withTransaction(async () => {
                const claimed = await AIGenerationModel.findOneAndUpdate(
                    {
                        _id: data.generationId,
                        adminId: data.adminId,
                        topicId: data.topicId,
                        generationType: "QUESTION",
                        status: { $in: ["COMPLETED", "PARTIAL"] },
                    },
                    { $set: { status: "COMMITTING" } },
                    { session, returnDocument: "after", runValidators: true },
                ).exec();

                if (!claimed) {
                    const committed = await this.findCommittedResult(data, session);
                    if (committed) {
                        transactionResult = committed;
                        return;
                    }
                    throw new AppError(
                        "AI_GENERATION_STATE_CONFLICT",
                        "AI generation không ở trạng thái có thể commit",
                        409,
                    );
                }

                await this.assertNoExistingQuestions(data, session);
                const created = await QuestionModel.insertMany(
                    data.items.map((item) => this.toPersistence(item, data)),
                    { session, ordered: true },
                );

                const resultIds = created.map((question) => question._id);
                const completed = await AIGenerationModel.findOneAndUpdate(
                    {
                        _id: data.generationId,
                        adminId: data.adminId,
                        status: "COMMITTING",
                    },
                    {
                        $set: {
                            status: "COMMITTED",
                            acceptedCount: created.length,
                            result: data.items.map((item) => item.candidate),
                            resultIds,
                            completedAt: new Date(),
                        },
                    },
                    { session, returnDocument: "after", runValidators: true },
                ).exec();
                if (!completed) {
                    throw new AppError(
                        "AI_GENERATION_STATE_CONFLICT",
                        "Không thể hoàn tất commit AI generation",
                        409,
                    );
                }
                transactionResult = { questions: created, alreadyCommitted: false };
            });

            if (!transactionResult) {
                throw new AppError(
                    "AI_QUESTION_COMMIT_FAILED",
                    "Không thể commit câu hỏi AI",
                    500,
                );
            }
            return transactionResult;
        } catch (error: unknown) {
            const committedAfterRace = await this.findCommittedResult(data);
            if (committedAfterRace) return committedAfterRace;
            if (error instanceof AppError) throw error;
            if (isDuplicateKeyError(error)) {
                throw new AppError(
                    "QUESTION_ALREADY_EXISTS",
                    "Một hoặc nhiều câu hỏi đã tồn tại trong chủ đề",
                    409,
                );
            }
            throw new AppError(
                "AI_QUESTION_COMMIT_FAILED",
                "Không thể commit câu hỏi AI",
                500,
            );
        } finally {
            await session.endSession();
        }
    }

    private async assertNoExistingQuestions(
        data: CommitAiQuestionGenerationData,
        session: ClientSession,
    ): Promise<void> {
        const vocabularyObjectIds = data.topicVocabularyIds.map((id) => new Types.ObjectId(id));
        const existing = await QuestionModel.find({
            $or: [
                { topicId: new Types.ObjectId(data.topicId) },
                { vocabularyId: { $in: vocabularyObjectIds } },
                { vocabularyIds: { $in: vocabularyObjectIds } },
                { "matchingPairs.vocabularyId": { $in: vocabularyObjectIds } },
            ],
        })
            .select("type content +dedupeKey")
            .session(session)
            .lean()
            .exec();
        const existingKeys = new Set(existing.map((question) =>
            question.dedupeKey
            ?? buildQuestionDedupeKey(data.topicId, question.type, question.content),
        ));
        if (data.items.some((item) => existingKeys.has(item.dedupeKey))) {
            throw new AppError(
                "QUESTION_ALREADY_EXISTS",
                "Một hoặc nhiều câu hỏi đã tồn tại trong chủ đề",
                409,
            );
        }
    }

    private toPersistence(
        item: AiQuestionCommitItem,
        data: CommitAiQuestionGenerationData,
    ): Record<string, unknown> {
        const candidate = item.candidate;
        const vocabularyIds = Array.from(new Set([
            ...(candidate.vocabularyId ? [candidate.vocabularyId] : []),
            ...(candidate.vocabularyIds ?? []),
            ...(candidate.type === "MATCHING"
                ? candidate.matchingPairs.flatMap((pair) =>
                    pair.vocabularyId ? [pair.vocabularyId] : [])
                : []),
        ]));
        const options = "options" in candidate
            ? candidate.options.map((option) => ({
                content: option.content,
                isCorrect: option.isCorrect,
                orderIndex: option.orderIndex,
            }))
            : undefined;
        const matchingPairs = "matchingPairs" in candidate
            ? candidate.matchingPairs.map((pair) => ({
                ...(pair.vocabularyId && { vocabularyId: new Types.ObjectId(pair.vocabularyId) }),
                leftValue: pair.leftValue,
                rightValue: pair.rightValue,
                orderIndex: pair.orderIndex,
            }))
            : undefined;

        return {
            topicId: new Types.ObjectId(data.topicId),
            vocabularyId: vocabularyIds[0] ? new Types.ObjectId(vocabularyIds[0]) : undefined,
            vocabularyIds: vocabularyIds.map((id) => new Types.ObjectId(id)),
            type: candidate.type,
            content: candidate.content,
            instruction: candidate.instruction,
            ...("correctAnswer" in candidate && { correctAnswer: candidate.correctAnswer }),
            options,
            matchingPairs,
            explanation: candidate.explanation,
            difficulty: candidate.difficulty,
            normalizedContent: normalizeQuestionContent(candidate.content),
            dedupeKey: item.dedupeKey,
            status: "DRAFT",
            createdByAi: true,
            aiGenerationId: new Types.ObjectId(data.generationId),
        };
    }

    private async findCommittedResult(
        data: CommitAiQuestionGenerationData,
        session?: ClientSession,
    ): Promise<CommitAiQuestionGenerationResult | null> {
        const generationQuery = AIGenerationModel.findOne({
            _id: data.generationId,
            adminId: data.adminId,
            topicId: data.topicId,
            generationType: "QUESTION",
            status: "COMMITTED",
        });
        if (session) generationQuery.session(session);
        const generation = await generationQuery.exec();
        if (!generation) return null;

        const questionQuery = QuestionModel.find({
            _id: { $in: generation.resultIds },
            aiGenerationId: generation._id,
        });
        if (session) questionQuery.session(session);
        const questions = await questionQuery.exec();
        const byId = new Map(questions.map((question) => [question._id.toString(), question]));
        const ordered = generation.resultIds
            .map((id) => byId.get(id.toString()))
            .filter((question): question is QuestionDocument => question !== undefined);
        return { questions: ordered, alreadyCommitted: true };
    }
}
