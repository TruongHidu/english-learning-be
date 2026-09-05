import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export const DIAMOND_TRANSACTION_TYPES = [
    "TOP_UP",
    "LESSON_REWARD",
    "BUY_HEART",
    "REWARD",
    "ADMIN_ADJUST",
] as const;

export type DiamondTransactionType = (typeof DIAMOND_TRANSACTION_TYPES)[number];

export interface DiamondTransactionPersistence {
    userId: Types.ObjectId;
    amount: number;
    type: DiamondTransactionType;
    balanceBefore: number;
    balanceAfter: number;
    referenceType?: string;
    referenceId?: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

export type DiamondTransactionDocument = HydratedDocument<DiamondTransactionPersistence>;

const diamondTransactionSchema = new Schema<DiamondTransactionPersistence>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        amount: { type: Number, required: true },
        type: { type: String, enum: DIAMOND_TRANSACTION_TYPES, required: true },
        balanceBefore: { type: Number, required: true, min: 0 },
        balanceAfter: { type: Number, required: true, min: 0 },
        referenceType: { type: String, required: false, trim: true },
        referenceId: { type: String, required: false, trim: true },
        description: { type: String, required: false, trim: true },
    },
    { timestamps: true, versionKey: false },
);

diamondTransactionSchema.index({ userId: 1, createdAt: -1 });

export const DiamondTransactionModel = model<DiamondTransactionPersistence>(
    "DiamondTransaction",
    diamondTransactionSchema,
);
