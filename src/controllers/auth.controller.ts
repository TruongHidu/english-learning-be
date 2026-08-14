import type { NextFunction, Request, Response } from "express";

import type { AuthService } from "../services/auth.service.js";
import type { LoginInput, RegisterInput } from "../types/auth.types.js";

export class AuthController {
    constructor(private readonly authService: AuthService) {}

    register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await this.authService.register(req.body as RegisterInput);
            res.status(201).json({
                success: true,
                message: "Đăng ký tài khoản thành công",
                data: result,
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await this.authService.login(req.body as LoginInput);
            res.status(200).json({
                success: true,
                message: "Đăng nhập thành công",
                data: result,
            });
        } catch (error: unknown) {
            next(error);
        }
    };
}
