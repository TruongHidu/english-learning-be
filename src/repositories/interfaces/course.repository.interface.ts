import type {
    Course,
    CourseListQuery,
    CourseStatus,
    CreateCourseInput,
    UpdateCourseInput,
} from "../../types/course.types.js";

export interface ICourseRepository {
    create(data: CreateCourseInput): Promise<Course>;
    findById(id: string): Promise<Course | null>;
    findPublishedById(id: string): Promise<Course | null>;
    findPublished(): Promise<Course[]>;
    findAllAdmin(query: CourseListQuery): Promise<{ courses: Course[]; total: number }>;
    updateById(id: string, data: UpdateCourseInput): Promise<Course | null>;
    updateStatus(id: string, status: CourseStatus): Promise<Course | null>;
    existsById(id: string): Promise<boolean>;
    count(filter?: Partial<CourseListQuery>): Promise<number>;
}
