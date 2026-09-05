import type { NextFunction, Request, Response } from "express";
import type { ShopService } from "../services/shop.service.js";

export class ShopController {
    constructor(private readonly shopService: ShopService) {}

    getShop = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = await this.shopService.getShop(req.user!.id);
            res.status(200).json({ success: true, message: "Lấy thông tin cửa hàng thành công", data });
        } catch (error) {
            next(error);
        }
    };

    purchaseHeart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = await this.shopService.purchaseHeart(req.user!.id);
            res.status(200).json({ success: true, message: "Mua tim thành công", data });
        } catch (error) {
            next(error);
        }
    };
}
