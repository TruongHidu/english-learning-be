import type { ClientSession } from "mongoose";
import type { DiamondTransactionDocument, DiamondTransactionType } from "../../models/diamond-transaction.model.js";

export interface CreateDiamondTransactionData {
    userId: string;
    amount: number;
    type: DiamondTransactionType;
    balanceBefore: number;
    balanceAfter: number;
    referenceType?: string;
    referenceId?: string;
    description?: string;
}

export interface IDiamondTransactionRepository {
    create(data: CreateDiamondTransactionData, session?: ClientSession): Promise<DiamondTransactionDocument>;
}
