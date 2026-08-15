import { AppError } from "../errors/app-error.js";
import { CourseMapper } from "../mappers/course.mapper.js";
import type { ICourseRepository } from "../repositories/interfaces/course.repository.interface.js";
import type {
    CourseListQuery,
    CourseResponse,
    CreateCourseInput,
    PaginatedCoursesResponse,
    UpdateCourseInput,
    UpdateCourseStatusInput,
} from "../types/course.types.js";

export class CourseService {
    constructor(private readonly courseRepository: ICourseRepository) {}

    async createCourse(input: CreateCourseInput): Promise<CourseResponse> {
        const course = await this.courseRepository.create(input);
        return CourseMapper.toResponse(course);
    }

    async getAdminCourses(query: CourseListQuery): Promise<PaginatedCoursesResponse> {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));

        const { courses, total } = await this.courseRepository.findAllAdmin(query);
        const totalPages = Math.ceil(total / limit);

        return {
            courses: CourseMapper.toListResponse(courses),
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        };
    }

    async getAdminCourseById(courseId: string): Promise<CourseResponse> {
        const course = await this.courseRepository.findById(courseId);

        if (!course) {
            throw new AppError("COURSE_NOT_FOUND", "Không tìm thấy khóa học", 404);
        }

        return CourseMapper.toResponse(course);
    }

    async updateCourse(courseId: string, input: UpdateCourseInput): Promise<CourseResponse> {
        const existingCourse = await this.courseRepository.findById(courseId);

        if (!existingCourse) {
            throw new AppError("COURSE_NOT_FOUND", "Không tìm thấy khóa học", 404);
        }

        const updatedCourse = await this.courseRepository.updateById(courseId, input);

        if (!updatedCourse) {
            throw new AppError("COURSE_NOT_FOUND", "Không tìm thấy khóa học", 404);
        }

        return CourseMapper.toResponse(updatedCourse);
    }

    async updateCourseStatus(
        courseId: string,
        input: UpdateCourseStatusInput,
    ): Promise<CourseResponse> {
        const existingCourse = await this.courseRepository.findById(courseId);

        if (!existingCourse) {
            throw new AppError("COURSE_NOT_FOUND", "Không tìm thấy khóa học", 404);
        }

        const updatedCourse = await this.courseRepository.updateStatus(courseId, input.status);

        if (!updatedCourse) {
            throw new AppError("COURSE_NOT_FOUND", "Không tìm thấy khóa học", 404);
        }

        return CourseMapper.toResponse(updatedCourse);
    }

    async deactivateCourse(courseId: string): Promise<CourseResponse> {
        const existingCourse = await this.courseRepository.findById(courseId);

        if (!existingCourse) {
            throw new AppError("COURSE_NOT_FOUND", "Không tìm thấy khóa học", 404);
        }

        const deactivatedCourse = await this.courseRepository.updateStatus(courseId, "INACTIVE");

        if (!deactivatedCourse) {
            throw new AppError("COURSE_NOT_FOUND", "Không tìm thấy khóa học", 404);
        }

        return CourseMapper.toResponse(deactivatedCourse);
    }

    async getPublishedCourses(): Promise<CourseResponse[]> {
        const courses = await this.courseRepository.findPublished();
        return CourseMapper.toListResponse(courses);
    }

    async getPublishedCourseById(courseId: string): Promise<CourseResponse> {
        const course = await this.courseRepository.findPublishedById(courseId);

        if (!course) {
            throw new AppError("COURSE_NOT_FOUND", "Không tìm thấy khóa học", 404);
        }

        return CourseMapper.toResponse(course);
    }
}
