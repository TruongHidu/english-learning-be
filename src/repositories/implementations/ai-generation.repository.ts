import { Types } from "mongoose";
import { AIGenerationModel, type AIGenerationDocument } from "../../models/ai-generation.model.js";
import type {
    CreateAIGenerationData,
    IAIGenerationRepository,
} from "../interfaces/ai-generation.repository.interface.js";
import type {
    AIGenerationListQuery,
    AIGenerationResultData,
} from "../../types/ai-generation.types.js";

export class AIGenerationRepository implements IAIGenerationRepository {
    async create(data: CreateAIGenerationData): Promise<AIGenerationDocument> {
        return AIGenerationModel.create({
            adminId: new Types.ObjectId(data.adminId),
            topicId: new Types.ObjectId(data.topicId),
            ...(data.lessonId && { lessonId: new Types.ObjectId(data.lessonId) }),
            generationType: data.generationType,
            status: "PENDING",
            provider: data.provider,
            modelName: data.modelName,
            promptVersion: data.promptVersion,
            requestedCount: data.requestedCount,
            generatedCount: 0,
            acceptedCount: 0,
            inputSnapshot: data.inputSnapshot,
            candidates: [],
            result: [],
            resultIds: [],
        });
    }

    async markProcessing(id: string, adminId: string): Promise<AIGenerationDocument | null> {
        return AIGenerationModel.findOneAndUpdate(
            { _id: id, adminId, status: "PENDING" },
            { $set: { status: "PROCESSING", startedAt: new Date() } },
            { returnDocument: "after", runValidators: true },
        ).exec();
    }

    async markCompleted(
        id: string,
        adminId: string,
        data: AIGenerationResultData,
    ): Promise<AIGenerationDocument | null> {
        return AIGenerationModel.findOneAndUpdate(
            { _id: id, adminId, status: "PROCESSING" },
            {
                $set: {
                    status: data.status,
                    generatedCount: data.generatedCount,
                    acceptedCount: data.acceptedCount,
                    candidates: data.candidates,
                    result: data.result,
                    resultIds: data.resultIds.map((id) => new Types.ObjectId(id)),
                    completedAt: new Date(),
                },
                $unset: { errorCode: 1, errorMessage: 1 },
            },
            { returnDocument: "after", runValidators: true },
        ).exec();
    }

    async markFailed(
        id: string,
        adminId: string,
        errorCode: string,
        errorMessage: string,
    ): Promise<AIGenerationDocument | null> {
        return AIGenerationModel.findOneAndUpdate(
            { _id: id, adminId, status: { $in: ["PENDING", "PROCESSING"] } },
            {
                $set: {
                    status: "FAILED",
                    errorCode: errorCode.slice(0, 100),
                    errorMessage: errorMessage.slice(0, 500),
                    completedAt: new Date(),
                },
            },
            { returnDocument: "after", runValidators: true },
        ).exec();
    }

    async markCanceled(
        id: string,
        adminId: string,
        errorCode: string,
        errorMessage: string,
    ): Promise<AIGenerationDocument | null> {
        return AIGenerationModel.findOneAndUpdate(
            { _id: id, adminId, status: { $in: ["PENDING", "PROCESSING"] } },
            {
                $set: {
                    status: "CANCELED",
                    errorCode: errorCode.slice(0, 100),
                    errorMessage: errorMessage.slice(0, 500),
                    completedAt: new Date(),
                },
            },
            { returnDocument: "after", runValidators: true },
        ).exec();
    }

    async findByIdForAdmin(id: string, adminId: string): Promise<AIGenerationDocument | null> {
        return AIGenerationModel.findOne({ _id: id, adminId }).exec();
    }

    async listForAdmin(
        adminId: string,
        query: AIGenerationListQuery,
    ): Promise<{ generations: AIGenerationDocument[]; total: number }> {
        const filter: Record<string, unknown> = { adminId };
        if (query.status) filter.status = query.status;
        if (query.generationType) filter.generationType = query.generationType;

        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
        const [generations, total] = await Promise.all([
            AIGenerationModel.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .exec(),
            AIGenerationModel.countDocuments(filter).exec(),
        ]);
        return { generations, total };
    }
}
