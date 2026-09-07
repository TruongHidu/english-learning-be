import type { RequestHandler } from "express";
import type { PaymentService } from "../services/payment.service.js";

export class PaymentController {
    constructor(private readonly service: PaymentService) {}

    checkout: RequestHandler = async (req, res, next) => {
        try {
            // req.ip trusts forwarded headers only when Express trust proxy is explicitly configured.
            const data = await this.service.checkout(req.user!.id, req.body.packageId, req.ip ?? req.socket.remoteAddress ?? "127.0.0.1");
            res.status(201).json({ success: true, message: "Tạo thanh toán thành công", data });
        } catch (error) { next(error); }
    };
    ipn: RequestHandler = async (req, res) => {
        const transactionCode = typeof req.query.vnp_TxnRef === "string" &&
            /^[a-zA-Z0-9]{1,100}$/.test(req.query.vnp_TxnRef)
            ? req.query.vnp_TxnRef
            : null;
        try {
            const result = await this.service.ipn(req.query);
            // Log only the merchant reference and our response. Never log the
            // callback query because it contains the signed payment payload.
            if (transactionCode) {
                console.info("[VNPAY_IPN]", {
                    transactionCode,
                    rspCode: result.RspCode,
                    message: result.Message,
                });
            }
            res.status(200).json(result);
        } catch {
            if (transactionCode) {
                console.error("[VNPAY_IPN]", {
                    transactionCode,
                    rspCode: "99",
                    message: "Unable to confirm payment",
                });
            }
            res.status(200).json({ RspCode: "99", Message: "Unable to confirm payment" });
        }
    };
    returnUrl: RequestHandler = async (req, res, next) => {
        try { res.redirect(await this.service.returnUrl(req.query)); }
        catch (error) { next(error); }
    };
    getPayment: RequestHandler = async (req, res, next) => {
        try {
            const data = await this.service.getPayment(req.user!.id, res.locals.validatedParams.paymentId);
            res.json({ success: true, message: "Lấy giao dịch thành công", data });
        } catch (error) { next(error); }
    };
    history: RequestHandler = async (req, res, next) => {
        try {
            const { page, limit } = res.locals.validatedQuery;
            const data = await this.service.history(req.user!.id, page, limit);
            res.json({ success: true, message: "Lấy lịch sử thanh toán thành công", data });
        } catch (error) { next(error); }
    };
}
