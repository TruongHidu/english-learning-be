

import mongoose from "mongoose";
import { HEART_PURCHASE_DIAMOND_COST, HEART_PURCHASE_QUANTITY } from "../config/shop.config.js";
import { HEART_REGEN_INTERVAL_MS } from "../config/heart.config.js";
import { AppError } from "../errors/app-error.js";
import type { IDiamondTransactionRepository } from "../repositories/interfaces/diamond-transaction.repository.interface.js";
import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";
import type { PurchaseHeartResponse, ShopResponse } from "../types/shop.types.js";
import type { HeartService } from "./heart.service.js";

interface HeartPurchaseResult {
    user: {
        stats: {
            currentHeart: number;
            maxHeart: number;
            heartUpdatedAt: Date;
        };
    };
    diamondBefore: number;
    diamondAfter: number;
}

export class ShopService {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly heartService: HeartService,
        private readonly diamondTransactionRepository: IDiamondTransactionRepository,
    ) { }

    async getShop(userId: string): Promise<ShopResponse> {
        const user = await this.heartService.syncUserHearts(userId);
        if (user.status !== "ACTIVE") {
            throw new AppError("ACCOUNT_NOT_ACTIVE", "Tài khoản hiện không thể sử dụng cửa hàng", 403);
        }

        const heartIsFull = user.stats.currentHeart >= user.stats.maxHeart;
        const hasEnoughDiamond = user.stats.diamond >= HEART_PURCHASE_DIAMOND_COST;
        const disabledReason = heartIsFull
            ? "HEART_ALREADY_FULL"
            : hasEnoughDiamond
                ? null
                : "INSUFFICIENT_DIAMOND";

        return {
            user: {
                diamond: user.stats.diamond,
                currentHeart: user.stats.currentHeart,
                maxHeart: user.stats.maxHeart,
                nextHeartAt: user.stats.nextHeartAt?.toISOString() ?? null,
            },
            items: [{
                id: "heart-single",
                type: "HEART",
                name: "Hồi phục Trái tim",
                description: "Cộng 1 trái tim để tiếp tục học.",
                quantity: HEART_PURCHASE_QUANTITY,
                diamondCost: HEART_PURCHASE_DIAMOND_COST,
                available: disabledReason === null,
                disabledReason,
            }],
            diamondPackages: [],
        };
    }

    async purchaseHeart(userId: string): Promise<PurchaseHeartResponse> {
        const user = await this.heartService.syncUserHearts(userId);
        if (user.status !== "ACTIVE") {
            throw new AppError("ACCOUNT_NOT_ACTIVE", "Tài khoản hiện không thể mua vật phẩm", 403);
        }
        if (user.stats.currentHeart >= user.stats.maxHeart) {
            throw new AppError("HEART_ALREADY_FULL", "Bạn đã có đầy đủ tim", 409);
        }
        if (user.stats.diamond < HEART_PURCHASE_DIAMOND_COST) {
            throw new AppError("INSUFFICIENT_DIAMOND", "Bạn không đủ kim cương để mua tim", 400);
        }

        let purchase: HeartPurchaseResult | null = null;
        let transactionId = "";

        const executePurchase = async (session?: mongoose.ClientSession) => {
            purchase = await this.userRepository.purchaseHeart(
                userId,
                HEART_PURCHASE_DIAMOND_COST,
                session,
            );
            if (!purchase) return;

            const transaction = await this.diamondTransactionRepository.create({
                userId,
                amount: -HEART_PURCHASE_DIAMOND_COST,
                type: "BUY_HEART",
                balanceBefore: purchase.diamondBefore,
                balanceAfter: purchase.diamondAfter,
                referenceType: "SHOP_ITEM",
                referenceId: "HEART_PURCHASE",
                description: "Mua 1 tim",
            }, session);
            transactionId = transaction._id.toString();
        };

        try {
            const session = await mongoose.startSession();
            try {
                await session.withTransaction(async () => {
                    await executePurchase(session);
                });
            } finally {
                await session.endSession();
            }
        } catch (error: any) {
            // Standalone MongoDB does not support replica set multi-document transactions.
            // In standalone mode, execute atomic findOneAndUpdate directly without transaction session.
            if (
                error?.code === 20 ||
                error?.codeName === "IllegalOperation" ||
                error?.message?.includes("replica set")
            ) {
                await executePurchase();
            } else {
                throw error;
            }
        }

        const completedPurchase = purchase as HeartPurchaseResult | null;
        if (!completedPurchase) {
            const latest = await this.heartService.syncUserHearts(userId);
            if (latest.stats.currentHeart >= latest.stats.maxHeart) {
                throw new AppError("HEART_ALREADY_FULL", "Bạn đã có đầy đủ tim", 409);
            }
            if (latest.stats.diamond < HEART_PURCHASE_DIAMOND_COST) {
                throw new AppError("INSUFFICIENT_DIAMOND", "Bạn không đủ kim cương để mua tim", 400);
            }
            throw new AppError("SHOP_PURCHASE_CONFLICT", "Số dư đã thay đổi. Vui lòng thử lại.", 409);
        }

        const nextHeartAt = completedPurchase.user.stats.currentHeart < completedPurchase.user.stats.maxHeart
            ? new Date(completedPurchase.user.stats.heartUpdatedAt.getTime() + HEART_REGEN_INTERVAL_MS).toISOString()
            : null;

        return {
            purchase: {
                item: "HEART",
                quantity: HEART_PURCHASE_QUANTITY,
                diamondCost: HEART_PURCHASE_DIAMOND_COST,
                transactionId,
            },
            hearts: {
                current: completedPurchase.user.stats.currentHeart,
                max: completedPurchase.user.stats.maxHeart,
                nextHeartAt,
            },
            diamond: {
                before: completedPurchase.diamondBefore,
                after: completedPurchase.diamondAfter,
            },
        };
    }
}
