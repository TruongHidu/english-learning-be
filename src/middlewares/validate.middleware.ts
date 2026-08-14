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

export const validateParams = (schema: ZodType): RequestHandler => (req, res, next): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
            field: issue.path.map(String).join(".") || "params",
            message: issue.message,
        }));

        const isIdError = errors.some((err) => err.field.toLowerCase().includes("id"));
        const errorCode = isIdError ? "INVALID_ID" : "VALIDATION_ERROR";
        const errorMessage = errors[0]?.message || "Tham số không hợp lệ";

        next(new AppError(errorCode, errorMessage, 400, errors));
        return;
    }

    res.locals.validatedParams = result.data;
    next();
};

export const validateQuery = (schema: ZodType): RequestHandler => (req, res, next): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
            field: issue.path.map(String).join(".") || "query",
            message: issue.message,
        }));

        next(new AppError("VALIDATION_ERROR", "Tham số truy vấn không hợp lệ", 400, errors));
        return;
    }

    res.locals.validatedQuery = result.data;
    next();
};
