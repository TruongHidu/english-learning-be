import mongoose, { Types, type ClientSession } from "mongoose";

import { AppError } from "../../errors/app-error.js";
import { AIGenerationModel } from "../../models/ai-generation.model.js";
import { VocabularyModel, type VocabularyDocument } from "../../models/vocabulary.model.js";
import { normalizeVocabularyWord } from "../../utils/vocabulary-normalization.utils.js";
import type {
    CommitAiVocabularyGenerationData,
    CommitAiVocabularyGenerationResult,
    IAiVocabularyCommitRepository,
} from "../interfaces/ai-vocabulary-commit.repository.interface.js";

interface MongoErrorLike {
    code?: number;
}

const isDuplicateKeyError = (error: unknown): error is MongoErrorLike =>
    typeof error === "object" && error !== null && "code" in error && error.code === 11000;

export class AiVocabularyCommitRepository implements IAiVocabularyCommitRepository {
    async commit(
        data: CommitAiVocabularyGenerationData,
    ): Promise<CommitAiVocabularyGenerationResult> {
        const existingCommit = await this.findCommittedResult(data);
        if (existingCommit) return existingCommit;

        const session = await mongoose.startSession();
        let transactionResult: CommitAiVocabularyGenerationResult | null = null;

        try {
            await session.withTransaction(async () => {
                const claimed = await AIGenerationModel.findOneAndUpdate(
                    {
                        _id: data.generationId,
                        adminId: data.adminId,
                        topicId: data.topicId,
                        generationType: "VOCABULARY",
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

                const existingWords = await VocabularyModel.find({ topicId: data.topicId })
                    .select("+normalizedWord word")
                    .session(session)
                    .lean()
                    .exec();
                const existingKeys = new Set(
                    existingWords.map((item) =>
                        item.normalizedWord ?? normalizeVocabularyWord(item.word),
                    ),
                );

                if (data.items.some((item) => existingKeys.has(item.normalizedWord))) {
                    throw new AppError(
                        "VOCABULARY_ALREADY_EXISTS",
                        "Một hoặc nhiều từ vựng đã tồn tại trong chủ đề",
                        409,
                    );
                }

                const created = await VocabularyModel.insertMany(
                    data.items.map((item) => ({
                        topicId: new Types.ObjectId(data.topicId),
                        word: item.word,
                        normalizedWord: item.normalizedWord,
                        meaning: item.meaning,
                        phonetic: item.phonetic,
                        partOfSpeech: item.partOfSpeech,
                        example: item.example,
                        exampleMeaning: item.exampleMeaning,
                        difficulty: data.difficulty,
                        status: "DRAFT",
                        createdByAi: true,
                        aiGenerationId: new Types.ObjectId(data.generationId),
                    })),
                    { session, ordered: true },
                );

                const result = data.items.map((item) => ({
                    candidateKey: item.candidateKey,
                    word: item.word,
                    meaning: item.meaning,
                    ...(item.phonetic && { phonetic: item.phonetic }),
                    ...(item.partOfSpeech && { partOfSpeech: item.partOfSpeech }),
                    ...(item.example && { example: item.example }),
                    ...(item.exampleMeaning && { exampleMeaning: item.exampleMeaning }),
                }));
                const resultIds = created.map((item) => item._id);
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
                            result,
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

                transactionResult = {
                    vocabularies: created,
                    alreadyCommitted: false,
                };
            });

            if (!transactionResult) {
                throw new AppError(
                    "AI_VOCABULARY_COMMIT_FAILED",
                    "Không thể commit từ vựng AI",
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
                    "VOCABULARY_ALREADY_EXISTS",
                    "Một hoặc nhiều từ vựng đã tồn tại trong chủ đề",
                    409,
                );
            }
            throw new AppError(
                "AI_VOCABULARY_COMMIT_FAILED",
                "Không thể commit từ vựng AI",
                500,
            );
        } finally {
            await session.endSession();
        }
    }

    private async findCommittedResult(
        data: CommitAiVocabularyGenerationData,
        session?: ClientSession,
    ): Promise<CommitAiVocabularyGenerationResult | null> {
        const generationQuery = AIGenerationModel.findOne({
            _id: data.generationId,
            adminId: data.adminId,
            topicId: data.topicId,
            generationType: "VOCABULARY",
            status: "COMMITTED",
        });
        if (session) generationQuery.session(session);
        const generation = await generationQuery.exec();
        if (!generation) return null;

        const vocabularyQuery = VocabularyModel.find({
            _id: { $in: generation.resultIds },
            aiGenerationId: generation._id,
        });
        if (session) vocabularyQuery.session(session);
        const vocabularies = await vocabularyQuery.exec();
        const byId = new Map(vocabularies.map((item) => [item._id.toString(), item]));
        const ordered = generation.resultIds
            .map((id) => byId.get(id.toString()))
            .filter((item): item is VocabularyDocument => item !== undefined);

        return { vocabularies: ordered, alreadyCommitted: true };
    }
}
