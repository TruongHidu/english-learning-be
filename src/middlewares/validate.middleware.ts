import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { AppError } from "../errors/app-error.js";

export const validate = (schema: ZodType): RequestHandler => (req, _res, next): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
            field: issue.path.map(String).join(".") || "body",
            message: issue.message,
        }));

        next(new AppError("VALIDATION_ERROR", "Dữ liệu không hợp lệ", 400, errors));
        return;
    }

    req.body = result.data;
    next();
};
