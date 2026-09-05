import { AppError } from "../errors/app-error.js";
import type { IDiamondPackageRepository } from "../repositories/interfaces/diamond-package.repository.interface.js";
import type { RealtimeService } from "./realtime.service.js";
import type {
    CreateDiamondPackageInput,
    DiamondPackage,
    UpdateDiamondPackageInput,
} from "../types/diamond-package.types.js";

export class AdminDiamondPackageService {
    constructor(
        private readonly repository: IDiamondPackageRepository,
        private readonly realtime: RealtimeService,
    ) {}

    async getPackages(): Promise<DiamondPackage[]> {
        return this.repository.findAll();
    }

    async getPackageById(id: string): Promise<DiamondPackage> {
        const pkg = await this.repository.findById(id);
        if (!pkg) {
            throw new AppError(
                "DIAMOND_PACKAGE_NOT_FOUND",
                "Không tìm thấy gói kim cương",
                404,
            );
        }
        return pkg;
    }

    async createPackage(data: CreateDiamondPackageInput): Promise<DiamondPackage> {
        const created = await this.repository.create(data);
        this.realtime.broadcast({
            type: "DIAMOND_PACKAGE_UPDATED",
            action: "CREATED",
            packageId: created.id,
        });
        return created;
    }

    async updatePackage(id: string, data: UpdateDiamondPackageInput): Promise<DiamondPackage> {
        const updated = await this.repository.update(id, data);
        if (!updated) {
            throw new AppError(
                "DIAMOND_PACKAGE_NOT_FOUND",
                "Không tìm thấy gói kim cương",
                404,
            );
        }
        this.realtime.broadcast({
            type: "DIAMOND_PACKAGE_UPDATED",
            action: "UPDATED",
            packageId: updated.id,
        });
        return updated;
    }

    async deletePackage(id: string): Promise<void> {
        const deleted = await this.repository.delete(id);
        if (!deleted) {
            throw new AppError(
                "DIAMOND_PACKAGE_NOT_FOUND",
                "Không tìm thấy gói kim cương",
                404,
            );
        }
        this.realtime.broadcast({
            type: "DIAMOND_PACKAGE_UPDATED",
            action: "DELETED",
            packageId: id,
        });
    }
}
