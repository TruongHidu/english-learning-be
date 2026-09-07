import { Schema, model, type Types } from "mongoose";
import { PAYMENT_STATUSES, type Payment } from "../types/payment.types.js";

export interface PaymentPersistence extends Omit<Payment, "id" | "userId" | "packageId"> {
    userId: Types.ObjectId;
    packageId: Types.ObjectId;
}
const integer = (min: number, max = Number.MAX_SAFE_INTEGER) => ({
    type: Number, required: true, min, max, validate: Number.isSafeInteger,
});
const schema = new Schema<PaymentPersistence>({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    packageId: { type: Schema.Types.ObjectId, ref: "DiamondPackage", required: true },
    packageCodeSnapshot: { type: String, required: true },
    packageNameSnapshot: { type: String, required: true },
    baseDiamondSnapshot: integer(1),
    bonusDiamondSnapshot: integer(0),
    diamondAmount: integer(1),
    amount: integer(5000, 9_999_999_999),
    currency: { type: String, enum: ["VND"], required: true },
    paymentMethod: { type: String, enum: ["VNPAY"], required: true },
    status: { type: String, enum: PAYMENT_STATUSES, default: "PENDING", required: true },
    transactionCode: { type: String, required: true, unique: true, match: /^[a-zA-Z0-9]{1,100}$/ },
    providerTransactionId: String,
    responseCode: String,
    transactionStatus: String,
    bankCode: String,
    cardType: String,
    payDate: String,
    paidAt: Date,
    expiresAt: { type: Date, required: true },
    retryVersion: { type: Number, default: 0 },
}, { timestamps: true, versionKey: false });
schema.index({ providerTransactionId: 1 }, { unique: true, partialFilterExpression: { providerTransactionId: { $type: "string" } } });
schema.index({ userId: 1, createdAt: -1, _id: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ status: 1, expiresAt: 1 });
schema.index({ userId: 1 }, { name: "uniq_pending_payment_per_user", unique: true,
    partialFilterExpression: { status: "PENDING" } });
export const PaymentTransactionModel = model<PaymentPersistence>("PaymentTransaction", schema);
