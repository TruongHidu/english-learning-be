import type { NextFunction, Request, Response } from "express";
import type { AdminDiamondPackageService } from "../services/admin-diamond-package.service.js";

export class AdminDiamondPackageController {
    constructor(private readonly service: AdminDiamondPackageService) {}

    getPackages = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = await this.service.getPackages();
            res.status(200).json({
                success: true,
                message: "Lấy danh sách gói kim cương thành công",
                data,
            });
        } catch (error) {
            next(error);
        }
    };

    getPackageById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { packageId } = (res.locals.validatedParams || req.params) as { packageId: string };
            const data = await this.service.getPackageById(packageId);
            res.status(200).json({
                success: true,
                message: "Lấy chi tiết gói kim cương thành công",
                data,
            });
        } catch (error) {
            next(error);
        }
    };

    createPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = await this.service.createPackage(req.body);
            res.status(201).json({
                success: true,
                message: "Tạo gói kim cương thành công",
                data,
            });
        } catch (error) {
            next(error);
        }
    };

    updatePackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { packageId } = (res.locals.validatedParams || req.params) as { packageId: string };
            const data = await this.service.updatePackage(packageId, req.body);
            res.status(200).json({
                success: true,
                message: "Cập nhật gói kim cương thành công",
                data,
            });
        } catch (error) {
            next(error);
        }
    };

    deletePackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { packageId } = (res.locals.validatedParams || req.params) as { packageId: string };
            await this.service.deletePackage(packageId);
            res.status(200).json({
                success: true,
                message: "Xóa gói kim cương thành công",
            });
        } catch (error) {
            next(error);
        }
    };
}
