export const PAYMENT_STATUSES = ["PENDING", "SUCCESS", "FAILED", "CANCELLED", "EXPIRED"] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export interface NewPayment {
    userId: string;
    packageId: string;
    packageCodeSnapshot: string;
    packageNameSnapshot: string;
    baseDiamondSnapshot: number;
    bonusDiamondSnapshot: number;
    diamondAmount: number;
    amount: number;
    currency: "VND";
    paymentMethod: "VNPAY";
    transactionCode: string;
    expiresAt: Date;
}

export interface Payment extends NewPayment {
    id: string;
    status: PaymentStatus;
    providerTransactionId?: string;
    responseCode?: string;
    transactionStatus?: string;
    bankCode?: string;
    cardType?: string;
    payDate?: string;
    paidAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface PaymentConfirmation {
    status: "SUCCESS" | "FAILED";
    providerTransactionId?: string;
    responseCode: string;
    transactionStatus: string;
    bankCode?: string;
    cardType?: string;
    payDate?: string;
    paidAt?: Date;
}

export interface IpnResponse {
    RspCode: "00" | "01" | "02" | "04" | "97" | "99";
    Message: string;
}
