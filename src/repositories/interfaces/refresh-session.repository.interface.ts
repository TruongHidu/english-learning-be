import type { RefreshSession } from "../../models/refresh-session.model.js";

export interface IRefreshSessionRepository {
    create(session: RefreshSession): Promise<void>;
    find(tokenHash: string): Promise<RefreshSession | null>;
    rotate(tokenHash: string, successor: RefreshSession, now: Date): Promise<boolean>;
    revokeFamily(familyId: string): Promise<void>;
    revokeUser(userId: string): Promise<void>;
}
