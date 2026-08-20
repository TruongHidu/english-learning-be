import { TopicModel, type TopicDocument } from "../../models/topic.model.js";
import {
    type CreateTopicInput,
    type TopicStatus,
    type UpdateTopicInput,
} from "../../types/topic.types.js";
import { type ITopicRepository } from "../interfaces/topic.repository.interface.js";

export class TopicRepository implements ITopicRepository {
    public async findById(id: string): Promise<TopicDocument | null> {
        return TopicModel.findById(id).exec();
    }

    public async findBySectionId(sectionId: string): Promise<TopicDocument[]> {
        return TopicModel.find({ sectionId })
            .sort({ orderIndex: 1, createdAt: 1, _id: 1 })
            .exec();
    }

    public async findPublishedBySectionId(sectionId: string): Promise<TopicDocument[]> {
        return TopicModel.find({ sectionId, status: "PUBLISHED" })
            .sort({ orderIndex: 1, createdAt: 1, _id: 1 })
            .exec();
    }

    public async findPublishedBySectionIds(sectionIds: string[]): Promise<TopicDocument[]> {
        if (sectionIds.length === 0) return [];

        return TopicModel.find({
            sectionId: { $in: sectionIds },
            status: "PUBLISHED",
        })
            .sort({ orderIndex: 1, createdAt: 1, _id: 1 })
            .exec();
    }

    public async findByNameAndSectionId(
        name: string,
        sectionId: string,
    ): Promise<TopicDocument | null> {
        // Case-insensitive exact match
        return TopicModel.findOne({
            sectionId,
            name: { $regex: new RegExp(`^${name}$`, "i") },
        }).exec();
    }

    public async create(
        sectionId: string,
        data: CreateTopicInput,
    ): Promise<TopicDocument> {
        return TopicModel.create({
            sectionId,
            name: data.name,
            description: data.description,
            orderIndex: data.orderIndex ?? 0,
            status: data.status ?? "DRAFT",
        });
    }

    public async update(
        id: string,
        data: UpdateTopicInput,
    ): Promise<TopicDocument | null> {
        return TopicModel.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true },
        ).exec();
    }

    public async updateStatus(
        id: string,
        status: TopicStatus,
    ): Promise<TopicDocument | null> {
        return TopicModel.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true, runValidators: true },
        ).exec();
    }

    public async deleteById(id: string): Promise<void> {
        await TopicModel.findByIdAndDelete(id).exec();
    }

    public async getMaxOrderIndex(sectionId: string): Promise<number> {
        const result = await TopicModel.findOne({ sectionId })
            .sort({ orderIndex: -1 })
            .select("orderIndex")
            .exec();
        
        return result?.orderIndex ?? -1;
    }

    public async reorder(sectionId: string, topicIds: string[]): Promise<void> {
        const bulkOps = topicIds.map((id, index) => ({
            updateOne: {
                filter: { _id: id, sectionId },
                update: { $set: { orderIndex: index } },
            },
        }));

        if (bulkOps.length > 0) {
            await TopicModel.bulkWrite(bulkOps);
        }
    }
}
