import { Router } from "express";
import { authenticate, authorizeUser, learningController } from "../config/container.js";
import { validate, validateParams } from "../middlewares/validate.middleware.js";
import {
    learningSessionIdParamSchema,
    submitAnswerBodySchema,
} from "../validators/learning.validator.js";

const sessionRouter = Router();

/**
 * POST /api/v1/sessions/:sessionId/submit-answer
 * User gửi đáp án, backend kiểm tra đúng/sai và cập nhật session.
 */
sessionRouter.post(
    "/:sessionId/submit-answer",
    authenticate,
    authorizeUser,
    validateParams(learningSessionIdParamSchema),
    validate(submitAnswerBodySchema),
    learningController.submitAnswer,
);

export default sessionRouter;
