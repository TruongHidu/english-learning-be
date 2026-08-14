import { CONTENT_STATUSES, type ContentStatus } from "./course.types.js";

export const SECTION_STATUSES = CONTENT_STATUSES;
export type SectionStatus = ContentStatus;

export interface Section {
    id: string;
    courseId: string;
    name: string;
    description?: string;
    orderIndex: number;
    status: SectionStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateSectionInput {
    name: string;
    description?: string;
    orderIndex: number;
    status?: SectionStatus;
}

export interface UpdateSectionInput {
    name?: string;
    description?: string;
    orderIndex?: number;
}

export interface UpdateSectionStatusInput {
    status: SectionStatus;
}

export interface SectionResponse {
    id: string;
    courseId: string;
    name: string;
    description: string | null;
    orderIndex: number;
    status: SectionStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface SectionListQuery {
    status?: SectionStatus;
}
