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
}
