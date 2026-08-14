import type { NextFunction, Request, Response } from "express";

import type { CourseService } from "../services/course.service.js";
import type {
    CourseListQuery,
    CreateCourseInput,
    UpdateCourseInput,
    UpdateCourseStatusInput,
} from "../types/course.types.js";

export class CourseController {
    constructor(private readonly courseService: CourseService) {}

    getPublishedCourses = async (
        _req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const courses = await this.courseService.getPublishedCourses();
            res.status(200).json({
                success: true,
                message: "Lấy danh sách khóa học thành công",
                data: { courses },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    getPublishedCourseById = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { courseId } = (res.locals.validatedParams ?? req.params) as {
                courseId: string;
            };
            const course = await this.courseService.getPublishedCourseById(courseId);
            res.status(200).json({
                success: true,
                message: "Lấy thông tin khóa học thành công",
                data: { course },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    getAdminCourses = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const query = (res.locals.validatedQuery ?? req.query) as CourseListQuery;
            const result = await this.courseService.getAdminCourses(query);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách khóa học thành công",
                data: result,
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    getAdminCourseById = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { courseId } = (res.locals.validatedParams ?? req.params) as {
                courseId: string;
            };
            const course = await this.courseService.getAdminCourseById(courseId);
            res.status(200).json({
                success: true,
                message: "Lấy thông tin khóa học thành công",
                data: { course },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    createCourse = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const course = await this.courseService.createCourse(
                req.body as CreateCourseInput,
            );
            res.status(201).json({
                success: true,
                message: "Tạo khóa học thành công",
                data: { course },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    updateCourse = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { courseId } = (res.locals.validatedParams ?? req.params) as {
                courseId: string;
            };
            const course = await this.courseService.updateCourse(
                courseId,
                req.body as UpdateCourseInput,
            );
            res.status(200).json({
                success: true,
                message: "Cập nhật khóa học thành công",
                data: { course },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    updateCourseStatus = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { courseId } = (res.locals.validatedParams ?? req.params) as {
                courseId: string;
            };
            const course = await this.courseService.updateCourseStatus(
                courseId,
                req.body as UpdateCourseStatusInput,
            );
            res.status(200).json({
                success: true,
                message: "Cập nhật trạng thái khóa học thành công",
                data: { course },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    deactivateCourse = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { courseId } = (res.locals.validatedParams ?? req.params) as {
                courseId: string;
            };
            const course = await this.courseService.deactivateCourse(courseId);
            res.status(200).json({
                success: true,
                message: "Ngừng sử dụng khóa học thành công",
                data: { course },
            });
        } catch (error: unknown) {
            next(error);
        }
    };
}
