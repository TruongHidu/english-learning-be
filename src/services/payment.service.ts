import { randomBytes } from "node:crypto";
import type { VnpayConfig } from "../config/vnpay.config.js";
import { AppError } from "../errors/app-error.js";
import type { PaymentGateway } from "../payments/payment-gateway.interface.js";
import { parseVnpayDate } from "../payments/vnpay.gateway.js";
import type { IPaymentTransactionRepository } from "../repositories/interfaces/payment-transaction.repository.interface.js";
import type { IDiamondPackageRepository } from "../repositories/interfaces/diamond-package.repository.interface.js";
import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";
import type { IpnResponse, Payment } from "../types/payment.types.js";

const response = (RspCode: IpnResponse["RspCode"], Message: string): IpnResponse => ({ RspCode, Message });

export function publicPayment(payment: Payment) {
    return {
        paymentId: payment.id, transactionCode: payment.transactionCode,
        packageName: payment.packageNameSnapshot, amount: payment.amount,
        diamondAmount: payment.diamondAmount, currency: payment.currency,
        paymentMethod: payment.paymentMethod, status: payment.status,
        createdAt: payment.createdAt.toISOString(), paidAt: payment.paidAt?.toISOString() ?? null,
        expiresAt: payment.expiresAt.toISOString(),
    };
}

export class PaymentService {
    constructor(
        private readonly payments: IPaymentTransactionRepository,
        private readonly packages: IDiamondPackageRepository,
        private readonly users: Pick<IUserRepository, "findById">,
        private readonly gateway: PaymentGateway,
        private readonly config: () => VnpayConfig,
    ) {}

    async checkout(userId: string, packageId: string, ipAddress: string) {
        const config = this.config();
        const user = await this.users.findById(userId);
        if (!user || user.status !== "ACTIVE") throw new AppError("ACCOUNT_NOT_ACTIVE", "Tài khoản không thể thanh toán", 403);
        const pkg = await this.packages.findById(packageId);
        if (!pkg || pkg.status !== "ACTIVE") throw new AppError("DIAMOND_PACKAGE_UNAVAILABLE", "Gói kim cương hiện không được bán", 400);
        const totalDiamond = pkg.diamondAmount + pkg.bonusDiamond;
        if (pkg.currency !== "VND" || !Number.isSafeInteger(pkg.price) || pkg.price < 5000 || pkg.price > 9_999_999_999 ||
            !Number.isSafeInteger(pkg.diamondAmount) || pkg.diamondAmount < 1 ||
            !Number.isSafeInteger(pkg.bonusDiamond) || pkg.bonusDiamond < 0 || !Number.isSafeInteger(totalDiamond)) {
            throw new AppError("INVALID_PAYMENT_PACKAGE", "Giá hoặc số kim cương không hợp lệ", 400);
        }
        const createdAt = new Date();
        const payment = await this.payments.create({
            userId, packageId: pkg.id,
            packageCodeSnapshot: pkg.code, packageNameSnapshot: pkg.name,
            baseDiamondSnapshot: pkg.diamondAmount, bonusDiamondSnapshot: pkg.bonusDiamond,
            diamondAmount: totalDiamond, amount: pkg.price, currency: "VND", paymentMethod: "VNPAY",
            transactionCode: `PAY${randomBytes(16).toString("hex")}`,
            expiresAt: new Date(createdAt.getTime() + config.VNPAY_EXPIRE_MINUTES * 60_000),
        });
        const paymentUrl = this.gateway.createPaymentUrl({ ...payment, createdAt, ipAddress });
        return {
            paymentId: payment.id, transactionCode: payment.transactionCode,
            status: payment.status, paymentUrl, expiresAt: payment.expiresAt.toISOString(),
        };
    }

    async ipn(query: Record<string, unknown>): Promise<IpnResponse> {
        try {
            const params = this.gateway.verifyCallback(query);
            if (!params) return response("97", "Invalid signature");
            if (params.vnp_TmnCode !== this.config().VNPAY_TMN_CODE) return response("99", "Invalid merchant");
            const code = params.vnp_TxnRef;
            if (!code || !/^[a-zA-Z0-9]{1,100}$/.test(code)) return response("99", "Invalid reference");
            const payment = await this.payments.findByCode(code);
            if (!payment) return response("01", "Order not found");
            if (!params.vnp_Amount || !/^\d{1,12}$/.test(params.vnp_Amount) || Number(params.vnp_Amount) !== payment.amount * 100) {
                return response("04", "Invalid amount");
            }
            if (payment.status !== "PENDING") return response("02", "Order already confirmed");
            const responseCode = params.vnp_ResponseCode;
            const transactionStatus = params.vnp_TransactionStatus;
            if (!responseCode || !/^\d{2}$/.test(responseCode) || !transactionStatus || !/^\d{2}$/.test(transactionStatus)) {
                return response("99", "Invalid payment result");
            }
            const success = responseCode === "00" && transactionStatus === "00";
            const hasPayDate = params.vnp_PayDate !== undefined;
            const paidAt = hasPayDate ? parseVnpayDate(params.vnp_PayDate!) : null;
            // VNPay documents vnp_PayDate as optional. Reject it only when it is
            // present but malformed; a missing value must not block a valid IPN.
            if (hasPayDate && !paidAt) return response("99", "Invalid pay date");
            const validProviderTransactionId = Boolean(
                params.vnp_TransactionNo && /^(?!0+$)\d{1,15}$/.test(params.vnp_TransactionNo),
            );
            if (success && !validProviderTransactionId) {
                return response("99", "Invalid successful transaction");
            }
            // Do not reject delayed IPN based on local expiry or reread the package.
            // Failed VNPay callbacks can use TransactionNo=0: never store that as a unique provider ID.
            const result = await this.payments.confirm(payment, {
                status: success ? "SUCCESS" : "FAILED", responseCode, transactionStatus,
                bankCode: params.vnp_BankCode, cardType: params.vnp_CardType,
                payDate: paidAt ? params.vnp_PayDate : undefined,
                ...(success ? {
                    providerTransactionId: params.vnp_TransactionNo,
                    ...(paidAt ? { paidAt } : {}),
                } : {}),
            });
            return result === "CONFIRMED" ? response("00", "Confirm Success") : response("02", "Order already confirmed");
        } catch {
            // Let VNPay retry; do not expose raw callback data, credentials or database errors.
            return response("99", "Unable to confirm payment");
        }
    }

    async returnUrl(query: Record<string, unknown>): Promise<string> {
        const config = this.config();
        const params = this.gateway.verifyCallback(query);
        const valid = Boolean(params && params.vnp_TmnCode === config.VNPAY_TMN_CODE);
        const url = new URL(config.PAYMENT_FRONTEND_RESULT_URL);
        url.searchParams.set("signatureValid", String(valid));
        if (valid && params?.vnp_TxnRef && /^[a-zA-Z0-9]{1,100}$/.test(params.vnp_TxnRef)) {
            url.searchParams.set("transactionCode", params.vnp_TxnRef);
            const payment = await this.payments.findByCode(params.vnp_TxnRef);
            if (payment) url.searchParams.set("paymentId", payment.id);
        }
        return url.toString();
    }

    async getPayment(userId: string, paymentId: string) {
        const payment = await this.payments.findOwned(paymentId, userId);
        if (!payment) throw new AppError("PAYMENT_NOT_FOUND", "Không tìm thấy giao dịch", 404);
        return publicPayment(payment);
    }

    async history(userId: string, page: number, limit: number) {
        const { payments, total } = await this.payments.listOwned(userId, page, limit);
        return { payments: payments.map(publicPayment), total, page, limit, totalPages: Math.ceil(total / limit) };
    }
}
