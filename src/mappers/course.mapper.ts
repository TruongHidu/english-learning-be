import type { Course, CourseResponse } from "../types/course.types.js";

export class CourseMapper {
    static toResponse(course: Course): CourseResponse {
        return {
            id: course.id,
            name: course.name,
            description: course.description ?? null,
            level: course.level,
            thumbnailUrl: course.thumbnailUrl ?? null,
            status: course.status,
            orderIndex: course.orderIndex,
            createdAt: course.createdAt,
            updatedAt: course.updatedAt,
        };
    }

    static toListResponse(courses: Course[]): CourseResponse[] {
        return courses.map((course) => CourseMapper.toResponse(course));
    }
}
