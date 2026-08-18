export type MediaKind = "image" | "audio";

export interface UploadableMediaFile {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
}

export interface StoredMedia {
    url: string;
    publicId: string;
    kind: MediaKind;
}

export interface QuestionMediaFiles {
    image?: UploadableMediaFile;
    audio?: UploadableMediaFile;
}

export interface IMediaStorage {
    upload(file: UploadableMediaFile, kind: MediaKind): Promise<StoredMedia>;
    delete(publicId: string, kind: MediaKind): Promise<void>;
}
