import mongoose from "mongoose";
import { RefreshSessionModel, type RefreshSession } from "../../models/refresh-session.model.js";
import type { IRefreshSessionRepository } from "../interfaces/refresh-session.repository.interface.js";

export class RefreshSessionRepository implements IRefreshSessionRepository {
    async create(session: RefreshSession): Promise<void> {
        await RefreshSessionModel.create(session);
    }
    async find(tokenHash: string): Promise<RefreshSession | null> {
        return RefreshSessionModel.findOne({ tokenHash }).lean().exec();
    }
    async rotate(tokenHash: string, successor: RefreshSession, now: Date): Promise<boolean> {
        return mongoose.connection.transaction(async (session) => {
            const consumed = await RefreshSessionModel.updateOne(
                { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
                { $set: { revokedAt: now, lastUsedAt: now, replacedByTokenHash: successor.tokenHash } },
                { session },
            );
            if (!consumed.modifiedCount) return false;
            await RefreshSessionModel.create([successor], { session });
            return true;
        });
    }
    async revokeFamily(familyId: string): Promise<void> {
        // Include consumed ancestors: writing them conflicts with concurrent rotation.
        await mongoose.connection.transaction(async (session) => {
            await RefreshSessionModel.updateMany({ familyId }, { $set: { revokedAt: new Date() } }, { session });
        });
    }
    async revokeUser(userId: string): Promise<void> {
        await mongoose.connection.transaction(async (session) => {
            await RefreshSessionModel.updateMany({ userId }, { $set: { revokedAt: new Date() } }, { session });
        });
    }
}
