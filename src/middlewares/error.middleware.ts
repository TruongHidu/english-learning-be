import type { ErrorRequestHandler } from "express";

import { AppError } from "../errors/app-error.js";

interface DuplicateKeyError {
    code: number;
}

const isDuplicateKeyError = (error: unknown): error is DuplicateKeyError =>
    typeof error === "object" && error !== null && "code" in error && error.code === 11000;

const isBodyParserSyntaxError = (error: unknown): boolean =>
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400 &&
    "body" in error;

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next): void => {
    if (error instanceof AppError) {
        res.status(error.statusCode).json({
            success: false,
            message: error.message,
            code: error.code,
            ...(error.errors && { errors: error.errors }),
        });
        return;
    }

    // Handles a race where two registrations pass the existence check simultaneously.
    if (isDuplicateKeyError(error)) {
        res.status(409).json({
            success: false,
            message: "Email đã được sử dụng",
            code: "EMAIL_ALREADY_EXISTS",
        });
        return;
    }

    if (isBodyParserSyntaxError(error)) {
        res.status(400).json({
            success: false,
            message: "Dữ liệu không hợp lệ",
            code: "VALIDATION_ERROR",
            errors: [{ field: "body", message: "JSON không hợp lệ" }],
        });
        return;
    }

    // Do not log request bodies, password values, password hashes, tokens, or secrets.
    console.error("Unhandled internal error");
    res.status(500).json({
        success: false,
        message: "Đã xảy ra lỗi nội bộ",
        code: "INTERNAL_SERVER_ERROR",
    });
};
