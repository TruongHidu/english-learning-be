import { SectionModel, type SectionDocument, type SectionPersistence } from "../../models/section.model.js";
import type {
    CreateSectionInput,
    Section,
    SectionListQuery,
    SectionStatus,
    UpdateSectionInput,
} from "../../types/section.types.js";
import type { ISectionRepository } from "../interfaces/section.repository.interface.js";

const toDomainSection = (document: SectionDocument): Section => ({
    id: document._id.toString(),
    courseId: document.courseId.toString(),
    name: document.name,
    description: document.description,
    orderIndex: document.orderIndex,
    status: document.status,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
});

export class SectionRepository implements ISectionRepository {
    async create(courseId: string, data: CreateSectionInput): Promise<Section> {
        const document = await SectionModel.create({
            courseId,
            name: data.name.trim(),
            description: data.description?.trim(),
            orderIndex: data.orderIndex,
            status: data.status ?? "DRAFT",
        });

        return toDomainSection(document);
    }

    async findById(id: string): Promise<Section | null> {
        const document = await SectionModel.findById(id).exec();
        return document ? toDomainSection(document) : null;
    }

    async findByCourseId(courseId: string, query?: SectionListQuery): Promise<Section[]> {
        const filter: Record<string, unknown> = { courseId };

        if (query?.status) {
            filter.status = query.status;
        }

        const documents = await SectionModel.find(filter)
            .sort({ orderIndex: 1, createdAt: 1, _id: 1 })
            .exec();

        return documents.map((doc) => toDomainSection(doc));
    }

    async findPublishedByCourseId(courseId: string): Promise<Section[]> {
        const documents = await SectionModel.find({
            courseId,
            status: "PUBLISHED",
        })
            .sort({ orderIndex: 1, createdAt: 1, _id: 1 })
            .exec();

        return documents.map((doc) => toDomainSection(doc));
    }

    async updateById(id: string, data: UpdateSectionInput): Promise<Section | null> {
        const updatePayload: Partial<SectionPersistence> = {};

        if (data.name !== undefined) updatePayload.name = data.name.trim();
        if (data.description !== undefined) updatePayload.description = data.description.trim();
        if (data.orderIndex !== undefined) updatePayload.orderIndex = data.orderIndex;

        const document = await SectionModel.findByIdAndUpdate(
            id,
            { $set: updatePayload },
            { returnDocument: "after", runValidators: true },
        ).exec();

        return document ? toDomainSection(document) : null;
    }

    async updateStatus(id: string, status: SectionStatus): Promise<Section | null> {
        const document = await SectionModel.findByIdAndUpdate(
            id,
            { $set: { status } },
            { returnDocument: "after", runValidators: true },
        ).exec();

        return document ? toDomainSection(document) : null;
    }

    async existsById(id: string): Promise<boolean> {
        const count = await SectionModel.countDocuments({ _id: id }).exec();
        return count > 0;
    }
}
