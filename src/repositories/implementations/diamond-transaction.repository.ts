import { DiamondTransactionModel, type DiamondTransactionDocument } from "../../models/diamond-transaction.model.js";
import type { CreateDiamondTransactionData, IDiamondTransactionRepository } from "../interfaces/diamond-transaction.repository.interface.js";
import type { ClientSession } from "mongoose";

export class DiamondTransactionRepository implements IDiamondTransactionRepository {
    async create(data: CreateDiamondTransactionData, session?: ClientSession): Promise<DiamondTransactionDocument> {
        const [transaction] = await DiamondTransactionModel.create([data], { session });
        if (!transaction) {
            throw new Error("Không thể tạo giao dịch kim cương");
        }
        return transaction;
    }
}
