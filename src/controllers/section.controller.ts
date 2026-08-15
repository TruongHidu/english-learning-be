import type { NextFunction, Request, Response } from "express";

import type { SectionService } from "../services/section.service.js";
import type {
    CreateSectionInput,
    SectionListQuery,
    UpdateSectionInput,
    UpdateSectionStatusInput,
} from "../types/section.types.js";

export class SectionController {
    constructor(private readonly sectionService: SectionService) {}

    getPublishedSections = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { courseId } = (res.locals.validatedParams ?? req.params) as {
                courseId: string;
            };
            const sections = await this.sectionService.getPublishedSectionsByCourse(courseId);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách phần học thành công",
                data: { sections },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    getAdminSectionsByCourse = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { courseId } = (res.locals.validatedParams ?? req.params) as {
                courseId: string;
            };
            const query = (res.locals.validatedQuery ?? req.query) as SectionListQuery;
            const sections = await this.sectionService.getAdminSectionsByCourse(
                courseId,
                query,
            );
            res.status(200).json({
                success: true,
                message: "Lấy danh sách phần học thành công",
                data: { sections },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    createSection = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { courseId } = (res.locals.validatedParams ?? req.params) as {
                courseId: string;
            };
            const section = await this.sectionService.createSection(
                courseId,
                req.body as CreateSectionInput,
            );
            res.status(201).json({
                success: true,
                message: "Tạo phần học thành công",
                data: { section },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    getAdminSectionById = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { sectionId } = (res.locals.validatedParams ?? req.params) as {
                sectionId: string;
            };
            const section = await this.sectionService.getAdminSectionById(sectionId);
            res.status(200).json({
                success: true,
                message: "Lấy thông tin phần học thành công",
                data: { section },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    updateSection = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { sectionId } = (res.locals.validatedParams ?? req.params) as {
                sectionId: string;
            };
            const section = await this.sectionService.updateSection(
                sectionId,
                req.body as UpdateSectionInput,
            );
            res.status(200).json({
                success: true,
                message: "Cập nhật phần học thành công",
                data: { section },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    updateSectionStatus = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { sectionId } = (res.locals.validatedParams ?? req.params) as {
                sectionId: string;
            };
            const section = await this.sectionService.updateSectionStatus(
                sectionId,
                req.body as UpdateSectionStatusInput,
            );
            res.status(200).json({
                success: true,
                message: "Cập nhật trạng thái phần học thành công",
                data: { section },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    deactivateSection = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { sectionId } = (res.locals.validatedParams ?? req.params) as {
                sectionId: string;
            };
            const section = await this.sectionService.deactivateSection(sectionId);
            res.status(200).json({
                success: true,
                message: "Ngừng sử dụng phần học thành công",
                data: { section },
            });
        } catch (error: unknown) {
            next(error);
        }
    };
}
