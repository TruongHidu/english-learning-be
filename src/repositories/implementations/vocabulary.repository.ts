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

export class VocabularyRepository implements IVocabularyRepository {
    public async findById(id: string): Promise<VocabularyDocument | null> {
        return VocabularyModel.findById(id).exec();
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
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
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
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
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
        return VocabularyModel.findOne({
            topicId,
            word: { $regex: new RegExp(`^${word.trim()}$`, "i") },
        }).exec();
    }

    public async create(
        topicId: string,
        data: CreateVocabularyInput,
    ): Promise<VocabularyDocument> {
        return VocabularyModel.create({
            topicId,
            word: data.word.trim(),
            meaning: data.meaning.trim(),
            phonetic: data.phonetic?.trim() || undefined,
            partOfSpeech: data.partOfSpeech?.trim() || undefined,
            example: data.example?.trim() || undefined,
            exampleMeaning: data.exampleMeaning?.trim() || undefined,
            audioUrl: data.audioUrl?.trim() || undefined,
            imageUrl: data.imageUrl?.trim() || undefined,
            difficulty: data.difficulty ?? "EASY",
            status: "DRAFT",
            createdByAi: false,
        });
    }

    public async update(
        id: string,
        data: UpdateVocabularyInput,
    ): Promise<VocabularyDocument | null> {
        return VocabularyModel.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true },
        ).exec();
    }

    public async updateStatus(
        id: string,
        status: ContentStatus,
    ): Promise<VocabularyDocument | null> {
        return VocabularyModel.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true, runValidators: true },
        ).exec();
    }

    public async deleteById(id: string): Promise<void> {
        await VocabularyModel.findByIdAndDelete(id).exec();
    }

    public async countByTopicId(topicId: string): Promise<number> {
        return VocabularyModel.countDocuments({ topicId }).exec();
    }
}
