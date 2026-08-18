import type { Request, RequestHandler } from "express";
import multer, { MulterError } from "multer";

import { AppError } from "../errors/app-error.js";
import type { QuestionMediaFiles } from "../storage/media-storage.interface.js";

const IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const AUDIO_MAX_SIZE = 20 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const AUDIO_MIME_TYPES = new Set([
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
    "audio/mp4",
    "audio/webm",
]);

const multerUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: 2,
        fileSize: AUDIO_MAX_SIZE,
    },
    fileFilter: (_req, file, callback): void => {
        const isValidImage = file.fieldname === "image" && IMAGE_MIME_TYPES.has(file.mimetype);
        const isValidAudio = file.fieldname === "audio" && AUDIO_MIME_TYPES.has(file.mimetype);

        if (!isValidImage && !isValidAudio) {
            callback(new AppError("INVALID_MEDIA_TYPE", "Định dạng ảnh hoặc âm thanh không hợp lệ", 400));
            return;
        }

        callback(null, true);
    },
}).fields([
    { name: "image", maxCount: 1 },
    { name: "audio", maxCount: 1 },
]);

const getFilesRecord = (req: Request): Record<string, Express.Multer.File[]> => {
    if (!req.files || Array.isArray(req.files)) return {};
    return req.files;
};

export const getQuestionMediaFiles = (req: Request): QuestionMediaFiles => {
    const files = getFilesRecord(req);
    const image = files.image?.[0];
    const audio = files.audio?.[0];

    return {
        ...(image && { image }),
        ...(audio && { audio }),
    };
};

export const uploadQuestionMedia: RequestHandler = (req, res, next): void => {
    multerUpload(req, res, (error: unknown): void => {
        if (error instanceof AppError) {
            next(error);
            return;
        }

        if (error instanceof MulterError) {
            const message = error.code === "LIMIT_FILE_SIZE"
                ? "File tải lên vượt quá dung lượng cho phép"
                : "Dữ liệu file tải lên không hợp lệ";
            next(new AppError("INVALID_MEDIA_UPLOAD", message, 400));
            return;
        }

        if (error) {
            next(new AppError("INVALID_MEDIA_UPLOAD", "Không thể đọc file tải lên", 400));
            return;
        }

        const { image, audio } = getQuestionMediaFiles(req);
        if (image && image.size > IMAGE_MAX_SIZE) {
            next(new AppError("IMAGE_TOO_LARGE", "Ảnh không được vượt quá 5 MB", 400));
            return;
        }
        if (audio && audio.size > AUDIO_MAX_SIZE) {
            next(new AppError("AUDIO_TOO_LARGE", "Âm thanh không được vượt quá 20 MB", 400));
            return;
        }

        next();
    });
};

export const parseQuestionMultipartPayload: RequestHandler = (req, _res, next): void => {
    if (!req.is("multipart/form-data")) {
        next();
        return;
    }

    const payload = (req.body as Record<string, unknown>).payload;
    if (typeof payload !== "string") {
        next(new AppError(
            "INVALID_MULTIPART_PAYLOAD",
            "Field payload JSON là bắt buộc khi tải file",
            400,
        ));
        return;
    }

    try {
        const parsed: unknown = JSON.parse(payload);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new Error("Payload must be an object");
        }
        req.body = parsed;
        next();
    } catch (_error: unknown) {
        next(new AppError("INVALID_MULTIPART_PAYLOAD", "Field payload không phải JSON hợp lệ", 400));
    }
};

export const requireListeningAudioOnCreate: RequestHandler = (req, _res, next): void => {
    const input = req.body as { type?: unknown; audioUrl?: unknown };
    const { audio } = getQuestionMediaFiles(req);

    if (input.type === "LISTENING" && !audio && !input.audioUrl) {
        next(new AppError(
            "VALIDATION_ERROR",
            "Dữ liệu không hợp lệ",
            400,
            [{ field: "audio", message: "File âm thanh là bắt buộc cho câu hỏi nghe LISTENING" }],
        ));
        return;
    }

    next();
};
