import { Router } from "express";
import { authenticate, authorizeUser, shopController } from "../config/container.js";

const shopRouter = Router();
shopRouter.use(authenticate, authorizeUser);
shopRouter.get("/", shopController.getShop);
shopRouter.post("/hearts/purchase", shopController.purchaseHeart);

export default shopRouter;
