import type { NextFunction, Request, Response } from "express";

import type { AuthService } from "../services/auth.service.js";
import type { LoginInput, RegisterInput } from "../types/auth.types.js";
import type { RefreshSessionService } from "../services/refresh-session.service.js";
import { REFRESH_COOKIE, refreshCookieOptions } from "../config/auth.config.js";

export class AuthController {
    constructor(private readonly authService: AuthService, private readonly refreshSessions: RefreshSessionService) {}

    private setCookie(res: Response, issued: { token: string; expiresAt: Date }): void {
        res.cookie(REFRESH_COOKIE, issued.token, { ...refreshCookieOptions(), maxAge: Math.max(0, issued.expiresAt.getTime() - Date.now()) });
        res.setHeader("Cache-Control", "no-store");
    }

    refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        res.setHeader("Cache-Control", "no-store");
        try {
            const issued = await this.refreshSessions.refresh(req.cookies?.[REFRESH_COOKIE]);
            this.setCookie(res, issued);
            res.json({ success: true, message: "Đã làm mới phiên đăng nhập", data: { accessToken: issued.accessToken } });
        } catch (error) {
            res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
            next(error);
        }
    };

    logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
        res.setHeader("Cache-Control", "no-store");
        try {
            await this.refreshSessions.logout(req.cookies?.[REFRESH_COOKIE]);
            res.json({ success: true, message: "Đã đăng xuất" });
        } catch (error) { next(error); }
    };

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
            this.setCookie(res, await this.refreshSessions.issue(result.user.id));
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
