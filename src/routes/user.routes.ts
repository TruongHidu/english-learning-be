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

export default userRouter;
