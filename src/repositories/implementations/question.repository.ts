import { Types } from "mongoose";

import {
    QuestionModel,
    type MatchingPairPersistence,
    type QuestionDocument,
    type QuestionOptionPersistence,
    type QuestionPersistence,
} from "../../models/question.model.js";
import type {
    QuestionListQuery,
    QuestionStatus,
} from "../../types/question.types.js";
import type {
    CreateQuestionData,
    IQuestionRepository,
    UpdateQuestionData,
} from "../interfaces/question.repository.interface.js";
import { buildVietnameseRegex } from "../../utils/vietnamese.utils.js";


export class QuestionRepository implements IQuestionRepository {
    public async findById(id: string): Promise<QuestionDocument | null> {
        return QuestionModel.findById(id)
            .select("+audioPublicId +imagePublicId")
            .populate("vocabularyIds vocabularyId", "word meaning")
            .exec();
    }

    public async findAll(
        query: QuestionListQuery,
    ): Promise<{ questions: QuestionDocument[]; total: number }> {
        const filter: Record<string, unknown> = {};

        if (query.vocabularyId) {
            filter.$or = [
                { vocabularyId: query.vocabularyId },
                { vocabularyIds: query.vocabularyId },
            ];
        }

        if (query.type) {
            filter.type = query.type;
        }

        if (query.difficulty) {
            filter.difficulty = query.difficulty;
        }

        if (query.status) {
            filter.status = query.status;
        }

        if (query.createdByAi !== undefined) {
            filter.createdByAi = query.createdByAi;
        }

        if (query.search) {
            const trimmedSearch = query.search.trim();
            if (trimmedSearch) {
                filter.content = { $regex: buildVietnameseRegex(trimmedSearch) };
            }
        }

        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
        const skip = (page - 1) * limit;

        const sortBy = query.sortBy ?? "createdAt";
        const sortOrder = query.sortOrder === "asc" ? 1 : -1;

        const [questions, total] = await Promise.all([
            QuestionModel.find(filter)
                .populate("vocabularyIds vocabularyId", "word meaning")
                .sort({ [sortBy]: sortOrder })
                .skip(skip)
                .limit(limit)
                .exec(),
            QuestionModel.countDocuments(filter).exec(),
        ]);

        return { questions, total };
    }

    public async create(data: CreateQuestionData): Promise<QuestionDocument> {
        const options: QuestionOptionPersistence[] | undefined = data.options
            ? data.options.map((opt) => ({
                  content: opt.content.trim(),
                  imageUrl: opt.imageUrl?.trim() || undefined,
                  isCorrect: opt.isCorrect,
                  orderIndex: opt.orderIndex,
              }))
            : undefined;

        const matchingPairs: MatchingPairPersistence[] | undefined = data.matchingPairs
            ? data.matchingPairs.map((pair) => ({
                  vocabularyId: pair.vocabularyId ? new Types.ObjectId(pair.vocabularyId) : undefined,
                  leftValue: pair.leftValue.trim(),
                  rightValue: pair.rightValue.trim(),
                  orderIndex: pair.orderIndex,
              }))
            : undefined;

        const vIds = data.vocabularyIds && data.vocabularyIds.length > 0
            ? data.vocabularyIds.map((id) => new Types.ObjectId(id))
            : (data.vocabularyId ? [new Types.ObjectId(data.vocabularyId)] : undefined);

        const primaryVId = data.vocabularyId
            ? new Types.ObjectId(data.vocabularyId)
            : (vIds && vIds.length > 0 ? vIds[0] : undefined);

        const created = await QuestionModel.create({
            vocabularyId: primaryVId,
            vocabularyIds: vIds,
            type: data.type,
            content: data.content.trim(),
            instruction: data.instruction?.trim() || undefined,
            correctAnswer: data.correctAnswer !== undefined ? data.correctAnswer : undefined,
            options,
            matchingPairs,
            explanation: data.explanation?.trim() || undefined,
            difficulty: data.difficulty ?? "EASY",
            audioUrl: data.audioUrl?.trim() || undefined,
            audioPublicId: data.audioPublicId?.trim() || undefined,
            imageUrl: data.imageUrl?.trim() || undefined,
            imagePublicId: data.imagePublicId?.trim() || undefined,
            status: "DRAFT",
            createdByAi: false,
        });

        return (await QuestionModel.findById(created._id).populate("vocabularyIds vocabularyId", "word meaning").exec())!;
    }

    public async update(
        id: string,
        data: UpdateQuestionData,
    ): Promise<QuestionDocument | null> {
        const updatePayload: Partial<QuestionPersistence> = {};
        const unsetPayload: Record<string, 1> = {};

        if (data.vocabularyIds !== undefined) {
            updatePayload.vocabularyIds = data.vocabularyIds
                ? data.vocabularyIds.map((vId) => new Types.ObjectId(vId))
                : undefined;
            if (data.vocabularyIds && data.vocabularyIds.length > 0) {
                updatePayload.vocabularyId = new Types.ObjectId(data.vocabularyIds[0]);
            }
        }
        if (data.vocabularyId !== undefined) {
            updatePayload.vocabularyId = data.vocabularyId ? new Types.ObjectId(data.vocabularyId) : undefined;
        }

        if (data.type !== undefined) updatePayload.type = data.type;
        if (data.content !== undefined) updatePayload.content = data.content.trim();
        if (data.instruction !== undefined) updatePayload.instruction = data.instruction?.trim() || undefined;
        if (data.correctAnswer !== undefined) updatePayload.correctAnswer = data.correctAnswer;
        if (data.explanation !== undefined) updatePayload.explanation = data.explanation?.trim() || undefined;
        if (data.difficulty !== undefined) updatePayload.difficulty = data.difficulty;
        if (data.audioUrl !== undefined) {
            const audioUrl = data.audioUrl?.trim();
            if (audioUrl) updatePayload.audioUrl = audioUrl;
            else unsetPayload.audioUrl = 1;
        }
        if (data.audioPublicId !== undefined) {
            const audioPublicId = data.audioPublicId?.trim();
            if (audioPublicId) updatePayload.audioPublicId = audioPublicId;
            else unsetPayload.audioPublicId = 1;
        }
        if (data.imageUrl !== undefined) {
            const imageUrl = data.imageUrl?.trim();
            if (imageUrl) updatePayload.imageUrl = imageUrl;
            else unsetPayload.imageUrl = 1;
        }
        if (data.imagePublicId !== undefined) {
            const imagePublicId = data.imagePublicId?.trim();
            if (imagePublicId) updatePayload.imagePublicId = imagePublicId;
            else unsetPayload.imagePublicId = 1;
        }

        if (data.options !== undefined) {
            updatePayload.options = data.options
                ? data.options.map((opt) => ({
                      content: opt.content.trim(),
                      imageUrl: opt.imageUrl?.trim() || undefined,
                      isCorrect: opt.isCorrect,
                      orderIndex: opt.orderIndex,
                  }))
                : undefined;
        }

        if (data.matchingPairs !== undefined) {
            updatePayload.matchingPairs = data.matchingPairs
                ? data.matchingPairs.map((pair) => ({
                      vocabularyId: pair.vocabularyId ? new Types.ObjectId(pair.vocabularyId) : undefined,
                      leftValue: pair.leftValue.trim(),
                      rightValue: pair.rightValue.trim(),
                      orderIndex: pair.orderIndex,
                  }))
                : undefined;
        }

        const updateOperation: {
            $set: Partial<QuestionPersistence>;
            $unset?: Record<string, 1>;
        } = { $set: updatePayload };

        if (Object.keys(unsetPayload).length > 0) {
            updateOperation.$unset = unsetPayload;
        }

        return QuestionModel.findByIdAndUpdate(
            id,
            updateOperation,
            { new: true, runValidators: true },
        )
            .select("+audioPublicId +imagePublicId")
            .populate("vocabularyIds vocabularyId", "word meaning")
            .exec();
    }

    public async updateStatus(
        id: string,
        status: QuestionStatus,
    ): Promise<QuestionDocument | null> {
        return QuestionModel.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true, runValidators: true },
        ).populate("vocabularyIds vocabularyId", "word meaning").exec();
    }

    public async deleteById(id: string): Promise<void> {
        await QuestionModel.findByIdAndDelete(id).exec();
    }

    public async countByVocabularyId(vocabularyId: string): Promise<number> {
        return QuestionModel.countDocuments({
            $or: [
                { vocabularyId },
                { vocabularyIds: vocabularyId },
            ],
        }).exec();
    }

    public async existsByIds(ids: string[]): Promise<boolean> {
        if (ids.length === 0) return true;
        const count = await QuestionModel.countDocuments({ _id: { $in: ids } }).exec();
        return count === ids.length;
    }

    public async findByIds(ids: string[]): Promise<QuestionDocument[]> {
        return QuestionModel.find({ _id: { $in: ids } }).populate("vocabularyIds vocabularyId", "word meaning").exec();
    }
}

