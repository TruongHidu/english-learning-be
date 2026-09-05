import { Router } from "express";
import { userVocabularyController, vocabularyReviewController, authenticate } from "../config/container.js";
import { validate, validateQuery } from "../middlewares/validate.middleware.js";
import { excludeReviewSchema } from "../validators/user-vocabulary.validator.js";
import { reviewDueQuerySchema, reviewSubmitSchema } from "../validators/user-vocabulary-review.validator.js";

const router = Router();

// LƯU TỪ ĐÃ HỌC
router.get(
    "/vocabularies/learned",
    authenticate,
    userVocabularyController.getLearned
);

router.patch(
    "/vocabularies/:vocabularyId/exclude-review",
    authenticate,
    validate(excludeReviewSchema),
    userVocabularyController.excludeFromReview
);

// ÔN TẬP TỪ VỰNG
router.get(
    "/vocabularies/review/session",
    authenticate,
    validateQuery(reviewDueQuerySchema),
    vocabularyReviewController.getSession
);

router.post(
    "/vocabularies/review/submit",
    authenticate,
    validate(reviewSubmitSchema),
    vocabularyReviewController.submitResults
);

router.get(
    "/vocabularies/review/stats",
    authenticate,
    vocabularyReviewController.getStats
);

export default router;
