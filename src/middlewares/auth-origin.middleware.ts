import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";

export const authOrigin: RequestHandler = (req, _res, next) => {
    const allowed = process.env.FRONTEND_URL;
    if (!allowed || allowed === "*" || req.get("origin") !== allowed) {
        next(new AppError("INVALID_ORIGIN", "Origin không được phép", 403));
        return;
    }
    next();
};
