export const CONTENT_STATUSES = ["DRAFT", "PUBLISHED", "INACTIVE"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const COURSE_STATUSES = CONTENT_STATUSES;
export type CourseStatus = ContentStatus;

export interface Course {
    id: string;
    name: string;
    description?: string;
    level: string;
    thumbnailUrl?: string;
    status: CourseStatus;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateCourseInput {
    name: string;
    description?: string;
    level: string;
    thumbnailUrl?: string | null;
    orderIndex: number;
    status?: CourseStatus;
}

export interface UpdateCourseInput {
    name?: string;
    description?: string;
    level?: string;
    thumbnailUrl?: string | null;
    orderIndex?: number;
}

export interface UpdateCourseStatusInput {
    status: CourseStatus;
}

export interface CourseResponse {
    id: string;
    name: string;
    description: string | null;
    level: string;
    thumbnailUrl: string | null;
    status: CourseStatus;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface CourseListQuery {
    page?: number;
    limit?: number;
    search?: string;
    status?: CourseStatus;
    level?: string;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedCoursesResponse {
    courses: CourseResponse[];
    pagination: PaginationMeta;
}
