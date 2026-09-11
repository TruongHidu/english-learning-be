import mongoose from "mongoose";
import { AppError } from "../../errors/app-error.js";
import { PaymentTransactionModel, type PaymentPersistence } from "../../models/payment-transaction.model.js";
import { UserModel } from "../../models/user.model.js";
import { DiamondTransactionModel } from "../../models/diamond-transaction.model.js";
import { realtimeService } from "../../services/realtime.service.js";
import type { NewPayment, Payment, PaymentConfirmation } from "../../types/payment.types.js";
import type { IPaymentTransactionRepository } from "../interfaces/payment-transaction.repository.interface.js";

const toPayment = (doc: PaymentPersistence & { _id: mongoose.Types.ObjectId }): Payment => {
    const { _id, ...data } = doc;
    return { ...data, id: _id.toString(), userId: doc.userId.toString(), packageId: doc.packageId.toString() };
};

export class PaymentTransactionRepository implements IPaymentTransactionRepository {
    async create(data: NewPayment): Promise<Payment> {
        try {
            return toPayment((await PaymentTransactionModel.create(data)).toObject());
        } catch (error) {
            const duplicate = error as { code?: number; message?: string; keyPattern?: Record<string, number> };
            if (duplicate.code === 11000 && (duplicate.message?.includes("uniq_pending_payment_per_user") ||
                (duplicate.keyPattern?.userId === 1 && Object.keys(duplicate.keyPattern).length === 1))) {
                throw new AppError("PAYMENT_PENDING_EXISTS",
                    "Bạn đang có một giao dịch chưa hoàn thành. Vui lòng thanh toán hoặc hủy giao dịch đó trước.", 409);
            }
            throw error;
        }
    }
    async findActivePendingByUser(userId: string, now: Date) {
        const doc = await PaymentTransactionModel.findOne({ userId, status: "PENDING", expiresAt: { $gt: now } }).lean();
        return doc ? toPayment(doc) : null;
    }
    async expirePendingByUser(userId: string, now: Date) {
        return (await PaymentTransactionModel.updateMany(
            { userId, status: "PENDING", expiresAt: { $lte: now } }, { $set: { status: "EXPIRED" } },
        )).modifiedCount;
    }
    async expireAllPending(now: Date) {
        return (await PaymentTransactionModel.updateMany(
            { status: "PENDING", expiresAt: { $lte: now } }, { $set: { status: "EXPIRED" } },
        )).modifiedCount;
    }
    async extendPendingPayment(payment: Payment, now: Date, expiresAt: Date) {
        const doc = await PaymentTransactionModel.findOneAndUpdate(
            { _id: payment.id, userId: payment.userId, status: "PENDING",
                expiresAt: { $gt: now, $eq: payment.expiresAt },
                retryVersion: payment.retryVersion ? payment.retryVersion : { $in: [null, 0] } },
            { $set: { expiresAt }, $inc: { retryVersion: 1 } },
            { returnDocument: "after", runValidators: true },
        ).lean();
        return doc ? toPayment(doc) : null;
    }
    async cancelPendingPayment(paymentId: string, userId: string, now: Date) {
        const doc = await PaymentTransactionModel.findOneAndUpdate(
            { _id: paymentId, userId, status: "PENDING", expiresAt: { $gt: now } },
            { $set: { status: "CANCELLED" } }, { returnDocument: "after", runValidators: true },
        ).lean();
        return doc ? toPayment(doc) : null;
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
        let notifiedUserId: string | null = null;
        let notifiedDiamond: number | null = null;
        try {
            const res = await session.withTransaction(async () => {
                const updated = await PaymentTransactionModel.findOneAndUpdate(
                    { _id: payment.id, status: confirmation.status === "SUCCESS" ?
                        { $in: ["PENDING", "CANCELLED", "EXPIRED"] } : "PENDING" },
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
                    notifiedUserId = updated.userId.toString();
                    notifiedDiamond = user.stats.diamond;
                }
                return "CONFIRMED" as const;
            });
            if (res === "CONFIRMED" && notifiedUserId && notifiedDiamond !== null) {
                realtimeService.notifyUser(notifiedUserId, {
                    type: "DIAMOND_UPDATED",
                    diamond: notifiedDiamond,
                });
            }
            return res;
        } finally {
            await session.endSession();
        }
    }
}
