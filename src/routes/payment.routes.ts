import { Router, type RequestHandler } from "express";
import type { PaymentController } from "../controllers/payment.controller.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { validate, validateParams, validateQuery } from "../middlewares/validate.middleware.js";
import { paymentCheckoutSchema, paymentHistorySchema, paymentIdSchema } from "../validators/payment.validator.js";

export function createPaymentRouter(controller: PaymentController, authenticate: RequestHandler) {
    const router = Router();
    router.get("/vnpay/return", controller.returnUrl);
    const userOnly = [authenticate, authorize("USER")];
    router.post("/vnpay/checkout", ...userOnly, validate(paymentCheckoutSchema), controller.checkout);
    router.get("/me", ...userOnly, validateQuery(paymentHistorySchema), controller.history);
    router.get("/:paymentId", ...userOnly, validateParams(paymentIdSchema), controller.getPayment);
    return router;
}
