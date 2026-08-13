export interface ValidationErrorDetail {
    field: string;
    message: string;
}

export class AppError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly statusCode: number,
        public readonly errors?: ValidationErrorDetail[],
    ) {
        super(message);
        this.name = "AppError";
        Error.captureStackTrace(this, this.constructor);
    }
}
