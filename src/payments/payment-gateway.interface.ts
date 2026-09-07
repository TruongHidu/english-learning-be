export interface PaymentUrlInput {
    transactionCode: string;
    amount: number;
    createdAt: Date;
    expiresAt: Date;
    ipAddress: string;
}

export interface PaymentGateway {
    createPaymentUrl(input: PaymentUrlInput): string;
    verifyCallback(query: Record<string, unknown>): Record<string, string> | null;
}
