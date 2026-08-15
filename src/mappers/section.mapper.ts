import type { Section, SectionResponse } from "../types/section.types.js";

export class SectionMapper {
    static toResponse(section: Section): SectionResponse {
        return {
            id: section.id,
            courseId: section.courseId,
            name: section.name,
            description: section.description ?? null,
            orderIndex: section.orderIndex,
            status: section.status,
            createdAt: section.createdAt,
            updatedAt: section.updatedAt,
        };
    }

    static toListResponse(sections: Section[]): SectionResponse[] {
        return sections.map((section) => SectionMapper.toResponse(section));
    }
}
