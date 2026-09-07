import type { Request, Response } from "express";

export interface DiamondUpdatedEvent {
    type: "DIAMOND_UPDATED";
    diamond: number;
    change?: number;
    reason?: string;
    balanceBefore?: number;
    balanceAfter?: number;
}

export interface DiamondPackageUpdatedEvent {
    type: "DIAMOND_PACKAGE_UPDATED";
    action: "CREATED" | "UPDATED" | "DELETED";
    packageId: string;
}

export interface ConnectedEvent {
    type: "CONNECTED";
    message: string;
}

export type RealtimeEvent = DiamondUpdatedEvent | DiamondPackageUpdatedEvent | ConnectedEvent;

export class RealtimeService {
    private readonly clients = new Map<string, Set<Response>>();

    registerClient(userId: string, req: Request, res: Response): void {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders?.();

        if (!this.clients.has(userId)) {
            this.clients.set(userId, new Set());
        }
        this.clients.get(userId)!.add(res);

        // Initial connection handshake
        res.write(`data: ${JSON.stringify({ type: "CONNECTED", message: "SSE connected successfully" })}\n\n`);

        // Keep-alive heartbeat interval every 25s
        const keepAlive = setInterval(() => {
            try {
                res.write(": ping\n\n");
            } catch {
                clearInterval(keepAlive);
            }
        }, 25000);

        req.on("close", () => {
            clearInterval(keepAlive);
            const userClients = this.clients.get(userId);
            if (userClients) {
                userClients.delete(res);
                if (userClients.size === 0) {
                    this.clients.delete(userId);
                }
            }
        });
    }

    notifyUser(userId: string, event: RealtimeEvent): void {
        const userClients = this.clients.get(userId);
        if (!userClients || userClients.size === 0) {
            return;
        }

        const payload = `data: ${JSON.stringify(event)}\n\n`;
        for (const client of userClients) {
            try {
                client.write(payload);
            } catch {
                userClients.delete(client);
            }
        }
    }

    broadcast(event: RealtimeEvent): void {
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        for (const [userId, userClients] of this.clients.entries()) {
            for (const client of userClients) {
                try {
                    client.write(payload);
                } catch {
                    userClients.delete(client);
                }
            }
            if (userClients.size === 0) {
                this.clients.delete(userId);
            }
        }
    }
}

export const realtimeService = new RealtimeService();
