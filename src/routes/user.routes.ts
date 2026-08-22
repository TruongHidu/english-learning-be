import { Router } from "express";

import { authenticate, userController } from "../config/container.js";
import { validate } from "../middlewares/validate.middleware.js";
import { changePasswordSchema, updateDisplayNameSchema } from "../validators/user.validator.js";

const userRouter = Router();

userRouter.get("/me", authenticate, userController.getMe);
userRouter.patch(
    "/me/name",
    authenticate,
    validate(updateDisplayNameSchema),
    userController.updateDisplayName,
);
userRouter.patch(
    "/me/password",
    authenticate,
    validate(changePasswordSchema),
    userController.changePassword,
);
userRouter.get("/vocabularies", authenticate, userController.getLearnedVocabularies);
userRouter.get("/vocabularies/by-sections", authenticate, userController.getVocabulariesBySections);
userRouter.get("/topics/:topicId/vocabularies", authenticate, userController.getTopicVocabularies);
userRouter.get("/lessons/:lessonId/vocabularies", authenticate, userController.getLessonVocabularies);

export default userRouter;


