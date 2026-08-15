import { CourseModel, type CourseDocument, type CoursePersistence } from "../../models/course.model.js";
import type {
    Course,
    CourseListQuery,
    CourseStatus,
    CreateCourseInput,
    UpdateCourseInput,
} from "../../types/course.types.js";
import type { ICourseRepository } from "../interfaces/course.repository.interface.js";

const escapeRegex = (value: string): string =>
    value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

const toDomainCourse = (document: CourseDocument): Course => ({
    id: document._id.toString(),
    name: document.name,
    description: document.description,
    level: document.level,
    thumbnailUrl: document.thumbnailUrl,
    status: document.status,
    orderIndex: document.orderIndex,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
});

export class CourseRepository implements ICourseRepository {
    async create(data: CreateCourseInput): Promise<Course> {
        const document = await CourseModel.create({
            name: data.name.trim(),
            description: data.description?.trim(),
            level: data.level.trim(),
            thumbnailUrl: data.thumbnailUrl?.trim() || undefined,
            orderIndex: data.orderIndex,
            status: data.status ?? "DRAFT",
        });

        return toDomainCourse(document);
    }

    async findById(id: string): Promise<Course | null> {
        const document = await CourseModel.findById(id).exec();
        return document ? toDomainCourse(document) : null;
    }

    async findPublishedById(id: string): Promise<Course | null> {
        const document = await CourseModel.findOne({ _id: id, status: "PUBLISHED" }).exec();
        return document ? toDomainCourse(document) : null;
    }

    async findPublished(): Promise<Course[]> {
        const documents = await CourseModel.find({ status: "PUBLISHED" })
            .sort({ orderIndex: 1, createdAt: 1 })
            .exec();

        return documents.map((doc) => toDomainCourse(doc));
    }

    async findAllAdmin(query: CourseListQuery): Promise<{ courses: Course[]; total: number }> {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};

        if (query.status) {
            filter.status = query.status;
        }

        if (query.level) {
            filter.level = query.level.trim();
        }

        if (query.search?.trim()) {
            filter.name = { $regex: escapeRegex(query.search.trim()), $options: "i" };
        }

        const [documents, total] = await Promise.all([
            CourseModel.find(filter)
                .sort({ orderIndex: 1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            CourseModel.countDocuments(filter).exec(),
        ]);

        return {
            courses: documents.map((doc) => toDomainCourse(doc)),
            total,
        };
    }

    async updateById(id: string, data: UpdateCourseInput): Promise<Course | null> {
        const updatePayload: Partial<CoursePersistence> = {};

        if (data.name !== undefined) updatePayload.name = data.name.trim();
        if (data.description !== undefined) updatePayload.description = data.description.trim();
        if (data.level !== undefined) updatePayload.level = data.level.trim();
        if (data.thumbnailUrl !== undefined) {
            updatePayload.thumbnailUrl = data.thumbnailUrl?.trim() || undefined;
        }
        if (data.orderIndex !== undefined) updatePayload.orderIndex = data.orderIndex;

        const document = await CourseModel.findByIdAndUpdate(
            id,
            { $set: updatePayload },
            { returnDocument: "after", runValidators: true },
        ).exec();

        return document ? toDomainCourse(document) : null;
    }

    async updateStatus(id: string, status: CourseStatus): Promise<Course | null> {
        const document = await CourseModel.findByIdAndUpdate(
            id,
            { $set: { status } },
            { returnDocument: "after", runValidators: true },
        ).exec();

        return document ? toDomainCourse(document) : null;
    }

    async existsById(id: string): Promise<boolean> {
        const count = await CourseModel.countDocuments({ _id: id }).exec();
        return count > 0;
    }

    async count(filter?: Partial<CourseListQuery>): Promise<number> {
        const queryFilter: Record<string, unknown> = {};
        if (filter?.status) queryFilter.status = filter.status;
        if (filter?.level) queryFilter.level = filter.level;
        return CourseModel.countDocuments(queryFilter).exec();
    }
}
