import type { RequestHandler } from "express";
import type { PaymentService } from "../services/payment.service.js";
import { AppError } from "../errors/app-error.js";

export class PaymentController {
    constructor(private readonly service: PaymentService) {}
    checkoutSepay: RequestHandler = async (req, res, next) => {
        try {
            res.status(201).json({ success: true, message: "Tạo thanh toán thành công",
                data: await this.service.checkoutSepay(req.user!.id, req.body.packageId) });
        } catch (error) { next(error); }
    };
    sepayWebhook: RequestHandler = async (req, res, next) => {
        try {
            await this.service.sepayWebhook(req.body, req.get("X-SePay-Signature"), req.get("X-SePay-Timestamp"));
            res.status(200).json({ success: true });
        } catch (error) {
            // Persistence errors (including duplicate keys) must request redelivery.
            next(error instanceof AppError ? error : new AppError("SEPAY_PROCESSING_FAILED", "Không thể xử lý webhook", 500));
        }
    };
    pending: RequestHandler = async (req, res, next) => {
        try { res.json({ success: true, message: "Lấy giao dịch đang chờ thành công", data: await this.service.pending(req.user!.id) }); }
        catch (error) { next(error); }
    };
    retry: RequestHandler = async (req, res, next) => {
        try {
            const data = await this.service.retry(req.user!.id, res.locals.validatedParams.paymentId,
                req.ip ?? req.socket.remoteAddress ?? "127.0.0.1");
            res.json({ success: true, message: "Gia hạn giao dịch thành công", data });
        } catch (error) { next(error); }
    };
    cancel: RequestHandler = async (req, res, next) => {
        try {
            const data = await this.service.cancel(req.user!.id, res.locals.validatedParams.paymentId);
            res.json({ success: true, message: data.status === "EXPIRED" ? "Giao dịch đã hết hạn" : "Hủy giao dịch thành công", data });
        } catch (error) { next(error); }
    };

    checkout: RequestHandler = async (req, res, next) => {
        try {
            // req.ip trusts forwarded headers only when Express trust proxy is explicitly configured.
            const data = await this.service.checkout(req.user!.id, req.body.packageId, req.ip ?? req.socket.remoteAddress ?? "127.0.0.1");
            res.status(201).json({ success: true, message: "Tạo thanh toán thành công", data });
        } catch (error) { next(error); }
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
