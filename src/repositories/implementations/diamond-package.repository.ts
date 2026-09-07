import { Types } from "mongoose";
import {
    DiamondPackageModel,
    type DiamondPackageDocument,
} from "../../models/diamond-package.model.js";
import type {
    CreateDiamondPackageInput,
    DiamondPackage,
    UpdateDiamondPackageInput,
} from "../../types/diamond-package.types.js";
import type { IDiamondPackageRepository } from "../interfaces/diamond-package.repository.interface.js";

const toDomainDiamondPackage = (doc: DiamondPackageDocument): DiamondPackage => ({
    id: doc._id.toString(),
    code: doc.code,
    name: doc.name,
    diamondAmount: doc.diamondAmount,
    bonusDiamond: doc.bonusDiamond ?? 0,
    totalDiamond: doc.diamondAmount + (doc.bonusDiamond ?? 0),
    price: doc.price,
    currency: doc.currency as "VND",
    description: doc.description,
    status: doc.status,
    orderIndex: doc.orderIndex,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
});

export class DiamondPackageRepository implements IDiamondPackageRepository {
    async findAll(): Promise<DiamondPackage[]> {
        const docs = await DiamondPackageModel.find()
            .sort({ orderIndex: 1, createdAt: 1 })
            .exec();
        return docs.map(toDomainDiamondPackage);
    }

    async findActive(): Promise<DiamondPackage[]> {
        const docs = await DiamondPackageModel.find({ status: "ACTIVE" })
            .sort({ orderIndex: 1, createdAt: 1 })
            .exec();
        return docs.map(toDomainDiamondPackage);
    }

    async findById(id: string): Promise<DiamondPackage | null> {
        if (!Types.ObjectId.isValid(id)) return null;
        const doc = await DiamondPackageModel.findById(id).exec();
        return doc ? toDomainDiamondPackage(doc) : null;
    }

    async findByCode(code: string): Promise<DiamondPackage | null> {
        const doc = await DiamondPackageModel.findOne({ code: code.trim() }).exec();
        return doc ? toDomainDiamondPackage(doc) : null;
    }

    async create(data: CreateDiamondPackageInput): Promise<DiamondPackage> {
        const code = data.code?.trim() || `CUSTOM_${new Types.ObjectId().toHexString().toUpperCase()}`;
        const doc = await DiamondPackageModel.create({
            code,
            name: data.name.trim(),
            diamondAmount: data.diamondAmount,
            bonusDiamond: data.bonusDiamond ?? 0,
            price: data.price,
            currency: data.currency ?? "VND",
            description: data.description?.trim() || undefined,
            status: data.status ?? "ACTIVE",
            orderIndex: data.orderIndex ?? 0,
        });

        return toDomainDiamondPackage(doc);
    }

    async update(id: string, data: UpdateDiamondPackageInput): Promise<DiamondPackage | null> {
        if (!Types.ObjectId.isValid(id)) return null;

        const updateFields: Record<string, unknown> = {};
        if (data.name !== undefined) updateFields.name = data.name.trim();
        if (data.diamondAmount !== undefined) updateFields.diamondAmount = data.diamondAmount;
        if (data.bonusDiamond !== undefined) updateFields.bonusDiamond = data.bonusDiamond;
        if (data.price !== undefined) updateFields.price = data.price;
        if (data.currency !== undefined) updateFields.currency = data.currency;
        if (data.description !== undefined) {
            updateFields.description = data.description?.trim() || undefined;
        }
        if (data.status !== undefined) updateFields.status = data.status;
        if (data.orderIndex !== undefined) updateFields.orderIndex = data.orderIndex;

        const doc = await DiamondPackageModel.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true, runValidators: true },
        ).exec();

        return doc ? toDomainDiamondPackage(doc) : null;
    }

    async delete(id: string): Promise<boolean> {
        if (!Types.ObjectId.isValid(id)) return false;
        const result = await DiamondPackageModel.findByIdAndUpdate(
            id, { $set: { status: "INACTIVE" } }, { runValidators: true },
        ).exec();
        return Boolean(result);
    }
}
