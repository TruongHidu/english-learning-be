import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error.js";
import type { ITokenService } from "../security/token-service.interface.js";

export const createAuthenticate = (tokenService: ITokenService): RequestHandler =>
    (req, _res, next): void => {
        const authorization = req.headers.authorization;

        if (!authorization?.startsWith("Bearer ")) {
            next(new AppError("UNAUTHORIZED", "Vui lòng đăng nhập", 401));
            return;
        }

        const token = authorization.slice("Bearer ".length).trim();
        if (!token) {
            next(new AppError("UNAUTHORIZED", "Vui lòng đăng nhập", 401));
            return;
        }

        try {
            const payload = tokenService.verifyAccessToken(token);
            req.user = { id: payload.sub, role: payload.role };
            next();
        } catch (_error: unknown) {
            next(new AppError("INVALID_TOKEN", "Token không hợp lệ hoặc đã hết hạn", 401));
        }
    };
