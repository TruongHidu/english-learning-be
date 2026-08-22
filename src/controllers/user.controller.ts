import type { NextFunction, Request, Response } from "express";

import type { UserService } from "../services/user.service.js";
import type { ChangePasswordInput, UpdateDisplayNameInput } from "../types/user.types.js";

export class UserController {
    constructor(private readonly userService: UserService) {}

    getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = await this.userService.getProfile(req.user!.id);
            res.status(200).json({
                success: true,
                message: "Lấy thông tin cá nhân thành công",
                data: { user },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    updateDisplayName = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const user = await this.userService.updateDisplayName(
                req.user!.id,
                req.body as UpdateDisplayNameInput,
            );
            res.status(200).json({
                success: true,
                message: "Cập nhật tên hiển thị thành công",
                data: { user },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.userService.changePassword(
                req.user!.id,
                req.body as ChangePasswordInput,
            );
            res.status(200).json({
                success: true,
                message: "Đổi mật khẩu thành công",
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    getLearnedVocabularies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const vocabularies = await this.userService.getLearnedVocabularies(req.user!.id);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách từ vựng đã học thành công",
                data: { vocabularies },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    getVocabulariesBySections = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const sections = await this.userService.getVocabulariesGroupedBySections(req.user!.id);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách từ vựng theo phần học thành công",
                data: { sections },
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    getTopicVocabularies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const topicId = req.params.topicId as string;
            const topicGroup = await this.userService.getVocabulariesByTopic(req.user!.id, topicId);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách từ vựng chủ đề thành công",
                data: { topicGroup },
            });
        } catch (error: unknown) {
            next(error);
        }
    };
    getLessonVocabularies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const lessonId = req.params.lessonId as string;
            const lessonGroup = await this.userService.getVocabulariesByLesson(req.user!.id, lessonId);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách từ vựng bài học thành công",
                data: { lessonGroup },
            });
        } catch (error: unknown) {
            next(error);
        }
    };
}




