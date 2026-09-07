import { Schema, model, type HydratedDocument } from "mongoose";
import type { DiamondPackageStatus } from "../types/diamond-package.types.js";

export interface DiamondPackagePersistence {
    code: string;
    name: string;
    diamondAmount: number;
    bonusDiamond: number;
    price: number;
    currency: "VND";
    description?: string;
    status: DiamondPackageStatus;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
}

export type DiamondPackageDocument = HydratedDocument<DiamondPackagePersistence>;

const diamondPackageSchema = new Schema<DiamondPackagePersistence>(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        diamondAmount: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isInteger,
                message: "Số kim cương phải là số nguyên",
            },
        },
        bonusDiamond: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
            validate: {
                validator: Number.isInteger,
                message: "Kim cương thưởng phải là số nguyên",
            },
        },
        price: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isInteger,
                message: "Giá gói phải là số nguyên",
            },
        },
        currency: {
            type: String,
            enum: ["VND"],
            default: "VND",
            required: true,
        },
        description: {
            type: String,
            required: false,
            trim: true,
        },
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE"],
            default: "ACTIVE",
            required: true,
            index: true,
        },
        orderIndex: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
            index: true,
            validate: {
                validator: Number.isInteger,
                message: "Thứ tự sắp xếp phải là số nguyên",
            },
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

export const DiamondPackageModel = model<DiamondPackagePersistence>(
    "DiamondPackage",
    diamondPackageSchema,
);
