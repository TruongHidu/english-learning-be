import { Types } from "mongoose";
import type { ContentStatus } from "../../types/course.types.js";
import {
    VocabularyModel,
    type VocabularyDocument,
} from "../../models/vocabulary.model.js";
import type {
    CreateVocabularyInput,
    UpdateVocabularyInput,
    VocabularyListQuery,
} from "../../types/vocabulary.types.js";
import type { IVocabularyRepository } from "../interfaces/vocabulary.repository.interface.js";
import { buildVietnameseRegex } from "../../utils/vietnamese.utils.js";
import { normalizeVocabularyWord } from "../../utils/vocabulary-normalization.utils.js";
import { AppError } from "../../errors/app-error.js";

const escapeRegex = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isDuplicateKeyError = (error: unknown): boolean =>
    typeof error === "object" && error !== null && "code" in error && error.code === 11000;

export class VocabularyRepository implements IVocabularyRepository {
    public async findById(id: string): Promise<VocabularyDocument | null> {
        return VocabularyModel.findById(id).exec();
    }

    public async findByIds(ids: string[]): Promise<VocabularyDocument[]> {
        if (ids.length === 0) return [];
        return VocabularyModel.find({ _id: { $in: ids } }).exec();
    }

    public async findByTopicId(
        topicId: string,
        query: VocabularyListQuery,
    ): Promise<{ vocabularies: VocabularyDocument[]; total: number }> {
        const filter: Record<string, unknown> = { topicId };

        if (query.status) {
            filter.status = query.status;
        }

        if (query.difficulty) {
            filter.difficulty = query.difficulty;
        }

        if (query.search) {
            const trimmedSearch = query.search.trim();
            if (trimmedSearch) {
                const searchRegex = buildVietnameseRegex(trimmedSearch);
                filter.$or = [{ word: searchRegex }, { meaning: searchRegex }];
            }
        }


        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(500, Math.max(1, query.limit ?? 500));
        const skip = (page - 1) * limit;

        const sortBy = query.sortBy ?? "createdAt";
        const sortOrder = query.sortOrder === "asc" ? 1 : -1;

        const [vocabularies, total] = await Promise.all([
            VocabularyModel.find(filter)
                .sort({ [sortBy]: sortOrder })
                .skip(skip)
                .limit(limit)
                .exec(),
            VocabularyModel.countDocuments(filter).exec(),
        ]);

        return { vocabularies, total };
    }

    public async findAll(
        query: VocabularyListQuery,
    ): Promise<{ vocabularies: VocabularyDocument[]; total: number }> {
        const filter: Record<string, unknown> = {};

        if (query.status) {
            filter.status = query.status;
        }

        if (query.difficulty) {
            filter.difficulty = query.difficulty;
        }

        if (query.search) {
            const trimmedSearch = query.search.trim();
            if (trimmedSearch) {
                const searchRegex = buildVietnameseRegex(trimmedSearch);
                filter.$or = [{ word: searchRegex }, { meaning: searchRegex }];
            }
        }


        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(500, Math.max(1, query.limit ?? 500));
        const skip = (page - 1) * limit;

        const sortBy = query.sortBy ?? "createdAt";
        const sortOrder = query.sortOrder === "asc" ? 1 : -1;

        const [vocabularies, total] = await Promise.all([
            VocabularyModel.find(filter)
                .sort({ [sortBy]: sortOrder })
                .skip(skip)
                .limit(limit)
                .exec(),
            VocabularyModel.countDocuments(filter).exec(),
        ]);

        return { vocabularies, total };
    }

    public async findByWordAndTopicId(
        word: string,
        topicId: string,
    ): Promise<VocabularyDocument | null> {
        const normalizedWord = normalizeVocabularyWord(word);
        return VocabularyModel.findOne({
            topicId,
            $or: [
                { normalizedWord },
                { word: { $regex: new RegExp(`^${escapeRegex(normalizedWord)}$`, "i") } },
            ],
        }).exec();
    }

    public async findWordsByTopicId(
        topicId: string,
    ): Promise<Array<{ id: string; word: string; normalizedWord?: string }>> {
        const documents = await VocabularyModel.find({ topicId })
            .select("+normalizedWord word")
            .lean()
            .exec();

        return documents.map((document) => ({
            id: document._id.toString(),
            word: document.word,
            ...(document.normalizedWord && { normalizedWord: document.normalizedWord }),
        }));
    }

    public async create(
        topicId: string,
        data: CreateVocabularyInput,
    ): Promise<VocabularyDocument> {
        const word = normalizeVocabularyWord(data.word);
        try {
            return await VocabularyModel.create({
                topicId,
                word,
                normalizedWord: word,
                meaning: data.meaning.trim(),
                phonetic: data.phonetic?.trim() || undefined,
                partOfSpeech: data.partOfSpeech?.trim() || undefined,
                example: data.example?.trim() || undefined,
                exampleMeaning: data.exampleMeaning?.trim() || undefined,
                audioUrl: data.audioUrl?.trim() || undefined,
                imageUrl: data.imageUrl?.trim() || undefined,
                difficulty: data.difficulty ?? "EASY",
                aiGenerationId: data.aiGenerationId ? new Types.ObjectId(data.aiGenerationId) : undefined,
                status: "DRAFT",
                createdByAi: Boolean(data.aiGenerationId),
            });
        } catch (error: unknown) {
            if (isDuplicateKeyError(error)) {
                throw new AppError(
                    "VOCABULARY_ALREADY_EXISTS",
                    "Từ vựng đã tồn tại trong chủ đề này",
                    409,
                );
            }
            throw error;
        }
    }

    public async update(
        id: string,
        data: UpdateVocabularyInput,
    ): Promise<VocabularyDocument | null> {
        const updateData: UpdateVocabularyInput & { normalizedWord?: string } = { ...data };
        if (data.word !== undefined) {
            const word = normalizeVocabularyWord(data.word);
            updateData.word = word;
            updateData.normalizedWord = word;
        }
        try {
            return await VocabularyModel.findByIdAndUpdate(
                id,
                { $set: updateData },
                { returnDocument: "after", runValidators: true },
            ).exec();
        } catch (error: unknown) {
            if (isDuplicateKeyError(error)) {
                throw new AppError(
                    "VOCABULARY_ALREADY_EXISTS",
                    "Từ vựng đã tồn tại trong chủ đề này",
                    409,
                );
            }
            throw error;
        }
    }

    public async updateStatus(
        id: string,
        status: ContentStatus,
    ): Promise<VocabularyDocument | null> {
        return VocabularyModel.findByIdAndUpdate(
            id,
            { $set: { status } },
            { returnDocument: "after", runValidators: true },
        ).exec();
    }

    public async deleteById(id: string): Promise<boolean> {
        const deleted = await VocabularyModel.findByIdAndDelete(id).exec();
        return deleted !== null;
    }

    public async countByTopicId(topicId: string): Promise<number> {
        return VocabularyModel.countDocuments({ topicId }).exec();
    }
}
