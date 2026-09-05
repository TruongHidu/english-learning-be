export type DiamondPackageStatus = "ACTIVE" | "INACTIVE";

export interface DiamondPackage {
    id: string;
    code: string;
    name: string;
    diamondAmount: number;
    bonusDiamond: number;
    totalDiamond: number;
    price: number;
    currency: "VND";
    description?: string;
    status: DiamondPackageStatus;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateDiamondPackageInput {
    code?: string;
    name: string;
    diamondAmount: number;
    bonusDiamond?: number;
    price: number;
    currency?: "VND";
    description?: string;
    status?: DiamondPackageStatus;
    orderIndex?: number;
}

export interface UpdateDiamondPackageInput {
    name?: string;
    diamondAmount?: number;
    bonusDiamond?: number;
    price?: number;
    currency?: "VND";
    description?: string;
    status?: DiamondPackageStatus;
    orderIndex?: number;
}

export interface DiamondPackageResponse {
    id: string;
    code: string;
    name: string;
    diamondAmount: number;
    bonusDiamond: number;
    totalDiamond: number;
    price: number;
    currency: "VND";
    description?: string;
    status: DiamondPackageStatus;
    orderIndex: number;
    createdAt: string;
    updatedAt: string;
}
