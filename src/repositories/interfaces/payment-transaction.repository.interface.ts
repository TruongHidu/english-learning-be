import type { NewPayment, Payment, PaymentConfirmation } from "../../types/payment.types.js";

export interface IPaymentTransactionRepository {
    create(data: NewPayment): Promise<Payment>;
    findActivePendingByUser(userId: string, now: Date): Promise<Payment | null>;
    expirePendingByUser(userId: string, now: Date): Promise<number>;
    expireAllPending(now: Date): Promise<number>;
    extendPendingPayment(payment: Payment, now: Date, expiresAt: Date): Promise<Payment | null>;
    cancelPendingPayment(paymentId: string, userId: string, now: Date): Promise<Payment | null>;
    findByCode(code: string): Promise<Payment | null>;
    findOwned(id: string, userId: string): Promise<Payment | null>;
    listOwned(userId: string, page: number, limit: number): Promise<{ payments: Payment[]; total: number }>;
    /** Atomically commits payment, wallet and ledger; never falls back to nontransactional writes. */
    confirm(payment: Payment, confirmation: PaymentConfirmation): Promise<"CONFIRMED" | "ALREADY_CONFIRMED">;
}
