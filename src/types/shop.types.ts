import type { DiamondTransactionDocument } from "../models/diamond-transaction.model.js";

export interface ShopItemResponse {
    id: string;
    type: "HEART";
    name: string;
    description: string;
    quantity: number;
    diamondCost: number;
    available: boolean;
    disabledReason: "HEART_ALREADY_FULL" | "INSUFFICIENT_DIAMOND" | null;
}

export interface ShopResponse {
    user: {
        diamond: number;
        currentHeart: number;
        maxHeart: number;
        nextHeartAt: string | null;
    };
    items: ShopItemResponse[];
    diamondPackages: unknown[];
}

export interface PurchaseHeartResponse {
    purchase: {
        item: "HEART";
        quantity: number;
        diamondCost: number;
        transactionId: string;
    };
    hearts: { current: number; max: number; nextHeartAt: string | null };
    diamond: { before: number; after: number };
}

export type { DiamondTransactionDocument };
