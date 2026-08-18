import {
    v2 as cloudinary,
    type UploadApiErrorResponse,
    type UploadApiResponse,
} from "cloudinary";

import type {
    IMediaStorage,
    MediaKind,
    StoredMedia,
    UploadableMediaFile,
} from "./media-storage.interface.js";

interface CloudinaryConfig {
    cloudName?: string;
    apiKey?: string;
    apiSecret?: string;
}

export class CloudinaryMediaStorage implements IMediaStorage {
    constructor(
        config: CloudinaryConfig = {
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            apiSecret: process.env.CLOUDINARY_API_SECRET,
        },
    ) {
        if (!config.cloudName || !config.apiKey || !config.apiSecret) {
            throw new Error("Cloudinary configuration is incomplete");
        }

        cloudinary.config({
            cloud_name: config.cloudName,
            api_key: config.apiKey,
            api_secret: config.apiSecret,
            secure: true,
        });
    }

    upload(file: UploadableMediaFile, kind: MediaKind): Promise<StoredMedia> {
        const resourceType = kind === "audio" ? "video" : "image";
        const folder = `english-learning/questions/${kind}`;

        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    resource_type: resourceType,
                    folder,
                    use_filename: false,
                    unique_filename: true,
                    overwrite: false,
                },
                (
                    error?: UploadApiErrorResponse,
                    result?: UploadApiResponse,
                ): void => {
                    if (error || !result) {
                        reject(new Error("Cloudinary media upload failed"));
                        return;
                    }

                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                        kind,
                    });
                },
            );

            stream.on("error", () => reject(new Error("Cloudinary upload stream failed")));
            stream.end(file.buffer);
        });
    }

    async delete(publicId: string, kind: MediaKind): Promise<void> {
        await cloudinary.uploader.destroy(publicId, {
            resource_type: kind === "audio" ? "video" : "image",
            invalidate: true,
        });
    }
}
