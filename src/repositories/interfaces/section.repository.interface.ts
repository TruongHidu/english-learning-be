import type {
    CreateSectionInput,
    Section,
    SectionListQuery,
    SectionStatus,
    UpdateSectionInput,
} from "../../types/section.types.js";

export interface ISectionRepository {
    create(courseId: string, data: CreateSectionInput): Promise<Section>;
    findById(id: string): Promise<Section | null>;
    findByCourseId(courseId: string, query?: SectionListQuery): Promise<Section[]>;
    findPublishedByCourseId(courseId: string): Promise<Section[]>;
    updateById(id: string, data: UpdateSectionInput): Promise<Section | null>;
    updateStatus(id: string, status: SectionStatus): Promise<Section | null>;
    existsById(id: string): Promise<boolean>;
}
