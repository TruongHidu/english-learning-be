import type {
    CreateDiamondPackageInput,
    DiamondPackage,
    UpdateDiamondPackageInput,
} from "../../types/diamond-package.types.js";

export interface IDiamondPackageRepository {
    findAll(): Promise<DiamondPackage[]>;
    findActive(): Promise<DiamondPackage[]>;
    findById(id: string): Promise<DiamondPackage | null>;
    findByCode(code: string): Promise<DiamondPackage | null>;
    create(data: CreateDiamondPackageInput): Promise<DiamondPackage>;
    update(id: string, data: UpdateDiamondPackageInput): Promise<DiamondPackage | null>;
    delete(id: string): Promise<boolean>;
}
