import { Schema, model } from "mongoose";

export interface RefreshSession {
    userId: string;
    tokenHash: string;
    familyId: string;
    createdAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
    replacedByTokenHash: string | null;
    lastUsedAt: Date | null;
}

const schema = new Schema<RefreshSession>({
    userId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
    lastUsedAt: { type: Date, default: null },
}, { versionKey: false });

export const RefreshSessionModel = model<RefreshSession>("RefreshSession", schema);
