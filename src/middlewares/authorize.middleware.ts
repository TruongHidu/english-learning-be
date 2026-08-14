import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error.js";
import type { UserRole } from "../types/auth.types.js";

export const authorize = (...roles: UserRole[]): RequestHandler => (req, _res, next): void => {
    if (!req.user) {
        next(new AppError("UNAUTHORIZED", "Vui lòng đăng nhập", 401));
        return;
    }

    if (!roles.includes(req.user.role)) {
        next(new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này", 403));
        return;
    }

    next();
};
