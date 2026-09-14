import { Router } from "express";
import {
  authenticate,
  userVocabularyController,
  vocabularyReviewController,
} from "../config/container.js";
import {
  validate,
  validateParams,
} from "../middlewares/validate.middleware.js";
import { excludeReviewSchema } from "../validators/user-vocabulary.validator.js";
import {
  bookmarkReviewSchema,
  createReviewSessionSchema,
  exitReviewSessionSchema,
  reviewBookmarkParamsSchema,
  reviewGoalSchema,
  reviewSessionParamsSchema,
  submitReviewAnswerSchema,
} from "../validators/user-vocabulary-review.validator.js";

const router = Router();
router.get(
  "/vocabularies/learned",
  authenticate,
  userVocabularyController.getLearned,
);
router.patch(
  "/vocabularies/:vocabularyId/exclude-review",
  authenticate,
  validate(excludeReviewSchema),
  userVocabularyController.excludeFromReview,
);
router.get(
  "/vocabularies/review/dashboard",
  authenticate,
  vocabularyReviewController.dashboard,
);
router.get(
  "/vocabularies/review/stats",
  authenticate,
  vocabularyReviewController.getStats,
);
router.post(
  "/vocabularies/review/sessions",
  authenticate,
  validate(createReviewSessionSchema),
  vocabularyReviewController.createSession,
);
router.get(
  "/vocabularies/review/sessions/:sessionId",
  authenticate,
  validateParams(reviewSessionParamsSchema),
  vocabularyReviewController.getSession,
);
router.post(
  "/vocabularies/review/sessions/:sessionId/answers",
  authenticate,
  validateParams(reviewSessionParamsSchema),
  validate(submitReviewAnswerSchema),
  vocabularyReviewController.answer,
);
router.post(
  "/vocabularies/review/sessions/:sessionId/complete",
  authenticate,
  validateParams(reviewSessionParamsSchema),
  vocabularyReviewController.complete,
);
router.post(
  "/vocabularies/review/sessions/:sessionId/exit",
  authenticate,
  validateParams(reviewSessionParamsSchema),
  validate(exitReviewSessionSchema),
  vocabularyReviewController.exit,
);
router.patch(
  "/vocabularies/:vocabularyId/bookmark",
  authenticate,
  validateParams(reviewBookmarkParamsSchema),
  validate(bookmarkReviewSchema),
  vocabularyReviewController.bookmark,
);
router.put(
  "/vocabularies/review/goal",
  authenticate,
  validate(reviewGoalSchema),
  vocabularyReviewController.setGoal,
);
export default router;
