import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error.js";
import type { ITokenService } from "../security/token-service.interface.js";

export const createAuthenticate = (tokenService: ITokenService): RequestHandler =>
    (req, _res, next): void => {
        let token: string | undefined;

        if (req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.slice("Bearer ".length).trim();
        } else if (typeof req.query.token === "string" && req.query.token.trim()) {
            token = req.query.token.trim();
        }

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
