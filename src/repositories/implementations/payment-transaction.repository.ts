import mongoose from "mongoose";
import { PaymentTransactionModel, type PaymentPersistence } from "../../models/payment-transaction.model.js";
import { UserModel } from "../../models/user.model.js";
import { DiamondTransactionModel } from "../../models/diamond-transaction.model.js";
import type { NewPayment, Payment, PaymentConfirmation } from "../../types/payment.types.js";
import type { IPaymentTransactionRepository } from "../interfaces/payment-transaction.repository.interface.js";

const toPayment = (doc: PaymentPersistence & { _id: mongoose.Types.ObjectId }): Payment => {
    const { _id, ...data } = doc;
    return { ...data, id: _id.toString(), userId: doc.userId.toString(), packageId: doc.packageId.toString() };
};

export class PaymentTransactionRepository implements IPaymentTransactionRepository {
    async create(data: NewPayment): Promise<Payment> {
        return toPayment((await PaymentTransactionModel.create(data)).toObject());
    }
    async findByCode(transactionCode: string): Promise<Payment | null> {
        const doc = await PaymentTransactionModel.findOne({ transactionCode }).lean().exec();
        return doc ? toPayment(doc) : null;
    }
    async findOwned(id: string, userId: string): Promise<Payment | null> {
        const doc = await PaymentTransactionModel.findOne({ _id: id, userId }).lean().exec();
        return doc ? toPayment(doc) : null;
    }
    async listOwned(userId: string, page: number, limit: number) {
        const [docs, total] = await Promise.all([
            PaymentTransactionModel.find({ userId }).sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit).limit(limit).lean().exec(),
            PaymentTransactionModel.countDocuments({ userId }).exec(),
        ]);
        return { payments: docs.map(toPayment), total };
    }
    async confirm(payment: Payment, confirmation: PaymentConfirmation): Promise<"CONFIRMED" | "ALREADY_CONFIRMED"> {
        const session = await mongoose.startSession();
        try {
            return await session.withTransaction(async () => {
                const updated = await PaymentTransactionModel.findOneAndUpdate(
                    { _id: payment.id, status: "PENDING" },
                    { $set: confirmation }, { session, returnDocument: "after", runValidators: true },
                ).exec();
                if (!updated) return "ALREADY_CONFIRMED" as const;
                if (confirmation.status === "SUCCESS") {
                    // Credit an existing account even if it was locked after checkout.
                    const user = await UserModel.findOneAndUpdate(
                        { _id: updated.userId, "stats.diamond": { $gte: 0, $lte: Number.MAX_SAFE_INTEGER - updated.diamondAmount } },
                        { $inc: { "stats.diamond": updated.diamondAmount } },
                        { session, returnDocument: "after" },
                    ).exec();
                    if (!user) throw new Error("Payment wallet unavailable");
                    await DiamondTransactionModel.create([{
                        userId: updated.userId,
                        amount: updated.diamondAmount,
                        type: "TOP_UP",
                        balanceBefore: user.stats.diamond - updated.diamondAmount,
                        balanceAfter: user.stats.diamond,
                        referenceType: "PAYMENT",
                        referenceId: updated._id.toString(),
                        description: `Nạp kim cương ${updated.transactionCode}`,
                    }], { session });
                }
                return "CONFIRMED" as const;
            });
        } finally {
            await session.endSession();
        }
    }
}
