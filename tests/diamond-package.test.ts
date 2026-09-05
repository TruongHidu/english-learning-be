import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../src/errors/app-error.js";
import { authorize } from "../src/middlewares/authorize.middleware.js";
import type { IDiamondPackageRepository } from "../src/repositories/interfaces/diamond-package.repository.interface.js";
import type { IDiamondTransactionRepository } from "../src/repositories/interfaces/diamond-transaction.repository.interface.js";
import type { IUserRepository } from "../src/repositories/interfaces/user.repository.interface.js";
import { AdminDiamondPackageService } from "../src/services/admin-diamond-package.service.js";
import { RealtimeService, type RealtimeEvent } from "../src/services/realtime.service.js";
import type { HeartService } from "../src/services/heart.service.js";
import { ShopService } from "../src/services/shop.service.js";
import type {
    CreateDiamondPackageInput,
    DiamondPackage,
    UpdateDiamondPackageInput,
} from "../src/types/diamond-package.types.js";
import {
    createDiamondPackageSchema,
    updateDiamondPackageSchema,
} from "../src/validators/diamond-package.validator.js";

class MockRealtimeService extends RealtimeService {
    public events: RealtimeEvent[] = [];

    override broadcast(event: RealtimeEvent): void {
        this.events.push(event);
    }
}

class InMemoryDiamondPackageRepository implements IDiamondPackageRepository {
    public packages: DiamondPackage[] = [];

    async findAll(): Promise<DiamondPackage[]> {
        return [...this.packages].sort((a, b) => a.orderIndex - b.orderIndex);
    }

    async findActive(): Promise<DiamondPackage[]> {
        return this.packages
            .filter((p) => p.status === "ACTIVE")
            .sort((a, b) => a.orderIndex - b.orderIndex);
    }

    async findById(id: string): Promise<DiamondPackage | null> {
        return this.packages.find((p) => p.id === id) ?? null;
    }

    async findByCode(code: string): Promise<DiamondPackage | null> {
        return this.packages.find((p) => p.code === code) ?? null;
    }

    async create(data: CreateDiamondPackageInput): Promise<DiamondPackage> {
        const id = `pkg-${this.packages.length + 1}`;
        const code = data.code ?? `CUSTOM_${id.toUpperCase()}`;
        const bonusDiamond = data.bonusDiamond ?? 0;
        const newPkg: DiamondPackage = {
            id,
            code,
            name: data.name.trim(),
            diamondAmount: data.diamondAmount,
            bonusDiamond,
            totalDiamond: data.diamondAmount + bonusDiamond,
            price: data.price,
            currency: data.currency ?? "VND",
            description: data.description?.trim(),
            status: data.status ?? "ACTIVE",
            orderIndex: data.orderIndex ?? 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.packages.push(newPkg);
        return newPkg;
    }

    async update(id: string, data: UpdateDiamondPackageInput): Promise<DiamondPackage | null> {
        const index = this.packages.findIndex((p) => p.id === id);
        if (index === -1) return null;
        const current = this.packages[index]!;
        const updatedDiamondAmount = data.diamondAmount ?? current.diamondAmount;
        const updatedBonusDiamond = data.bonusDiamond ?? current.bonusDiamond;
        const updated: DiamondPackage = {
            ...current,
            name: data.name !== undefined ? data.name.trim() : current.name,
            diamondAmount: updatedDiamondAmount,
            bonusDiamond: updatedBonusDiamond,
            totalDiamond: updatedDiamondAmount + updatedBonusDiamond,
            price: data.price ?? current.price,
            currency: data.currency ?? current.currency,
            description: data.description !== undefined ? data.description.trim() : current.description,
            status: data.status ?? current.status,
            orderIndex: data.orderIndex ?? current.orderIndex,
            updatedAt: new Date(),
        };
        this.packages[index] = updated;
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        const initialLength = this.packages.length;
        this.packages = this.packages.filter((p) => p.id !== id);
        return this.packages.length < initialLength;
    }
}

test("Admin creates Diamond Package successfully with generated code", async () => {
    const repo = new InMemoryDiamondPackageRepository();
    const mockRealtime = new MockRealtimeService();
    const service = new AdminDiamondPackageService(repo, mockRealtime);

    const created = await service.createPackage({
        name: "Túi Đá Quý",
        diamondAmount: 100,
        bonusDiamond: 0,
        price: 19000,
        currency: "VND",
        status: "ACTIVE",
        orderIndex: 1,
    });

    assert.equal(created.name, "Túi Đá Quý");
    assert.equal(created.diamondAmount, 100);
    assert.equal(created.bonusDiamond, 0);
    assert.equal(created.totalDiamond, 100);
    assert.equal(created.price, 19000);
    assert.equal(created.status, "ACTIVE");
    assert.ok(created.code.startsWith("CUSTOM_"));

    assert.equal(mockRealtime.events.length, 1);
    assert.deepEqual(mockRealtime.events[0], {
        type: "DIAMOND_PACKAGE_UPDATED",
        action: "CREATED",
        packageId: created.id,
    });
});

test("USER cannot call Admin API and ADMIN is authorized", () => {
    const adminMiddleware = authorize("ADMIN");
    let userError: unknown;
    let adminPassed = false;

    adminMiddleware(
        { user: { id: "user1", role: "USER" } } as never,
        {} as never,
        (error?: unknown) => { userError = error; },
    );
    adminMiddleware(
        { user: { id: "admin1", role: "ADMIN" } } as never,
        {} as never,
        (error?: unknown) => { adminPassed = error === undefined; },
    );

    assert.equal(userError instanceof AppError && userError.code === "FORBIDDEN", true);
    assert.equal(adminPassed, true);
});

test("Validation rejects package with diamondAmount <= 0 or non-integer", () => {
    const zeroAmount = createDiamondPackageSchema.safeParse({
        name: "Gói test",
        diamondAmount: 0,
        price: 10000,
    });
    assert.equal(zeroAmount.success, false);

    const negativeAmount = createDiamondPackageSchema.safeParse({
        name: "Gói test",
        diamondAmount: -50,
        price: 10000,
    });
    assert.equal(negativeAmount.success, false);

    const floatAmount = createDiamondPackageSchema.safeParse({
        name: "Gói test",
        diamondAmount: 10.5,
        price: 10000,
    });
    assert.equal(floatAmount.success, false);
});

test("Validation rejects package with bonusDiamond < 0 or non-integer", () => {
    const negativeBonus = createDiamondPackageSchema.safeParse({
        name: "Gói test",
        diamondAmount: 100,
        bonusDiamond: -5,
        price: 10000,
    });
    assert.equal(negativeBonus.success, false);

    const floatBonus = createDiamondPackageSchema.safeParse({
        name: "Gói test",
        diamondAmount: 100,
        bonusDiamond: 2.5,
        price: 10000,
    });
    assert.equal(floatBonus.success, false);
});

test("Validation rejects package with price <= 0 or non-integer", () => {
    const zeroPrice = createDiamondPackageSchema.safeParse({
        name: "Gói test",
        diamondAmount: 100,
        price: 0,
    });
    assert.equal(zeroPrice.success, false);

    const floatPrice = createDiamondPackageSchema.safeParse({
        name: "Gói test",
        diamondAmount: 100,
        price: 19000.5,
    });
    assert.equal(floatPrice.success, false);
});

test("Validation rejects package with empty or whitespace name", () => {
    const emptyName = createDiamondPackageSchema.safeParse({
        name: "   ",
        diamondAmount: 100,
        price: 19000,
    });
    assert.equal(emptyName.success, false);
});

test("Validation accepts valid packages with prices 19000, 49000, and 99000", () => {
    for (const price of [19000, 49000, 99000]) {
        const result = createDiamondPackageSchema.safeParse({
            name: `Gói ${price}`,
            diamondAmount: 100,
            price,
        });
        assert.equal(result.success, true);
        if (result.success) {
            assert.equal(result.data.price, price);
        }

        const updateResult = updateDiamondPackageSchema.safeParse({
            price,
        });
        assert.equal(updateResult.success, true);
    }
});

test("Admin updates package successfully and preserves immutable code", async () => {
    const repo = new InMemoryDiamondPackageRepository();
    const mockRealtime = new MockRealtimeService();
    const service = new AdminDiamondPackageService(repo, mockRealtime);

    const created = await service.createPackage({
        code: "DIAMOND_SMALL",
        name: "Túi Đá Quý",
        diamondAmount: 100,
        bonusDiamond: 0,
        price: 19000,
    });

    const updated = await service.updatePackage(created.id, {
        name: "Túi Đá Quý VIP",
        price: 25000,
        diamondAmount: 120,
        bonusDiamond: 10,
    });

    assert.equal(updated.name, "Túi Đá Quý VIP");
    assert.equal(updated.price, 25000);
    assert.equal(updated.diamondAmount, 120);
    assert.equal(updated.bonusDiamond, 10);
    assert.equal(updated.totalDiamond, 130);
    assert.equal(updated.code, "DIAMOND_SMALL"); // code must remain unchanged

    assert.equal(mockRealtime.events.length, 2);
    assert.deepEqual(mockRealtime.events[1], {
        type: "DIAMOND_PACKAGE_UPDATED",
        action: "UPDATED",
        packageId: created.id,
    });
});

test("Admin changes package status from ACTIVE to INACTIVE", async () => {
    const repo = new InMemoryDiamondPackageRepository();
    const mockRealtime = new MockRealtimeService();
    const service = new AdminDiamondPackageService(repo, mockRealtime);

    const created = await service.createPackage({
        name: "Rương Bạc",
        diamondAmount: 500,
        price: 49000,
        status: "ACTIVE",
    });

    const updated = await service.updatePackage(created.id, {
        status: "INACTIVE",
    });

    assert.equal(updated.status, "INACTIVE");

    assert.equal(mockRealtime.events.length, 2);
    assert.deepEqual(mockRealtime.events[1], {
        type: "DIAMOND_PACKAGE_UPDATED",
        action: "UPDATED",
        packageId: created.id,
    });
});

test("Admin deletes package successfully", async () => {
    const repo = new InMemoryDiamondPackageRepository();
    const mockRealtime = new MockRealtimeService();
    const service = new AdminDiamondPackageService(repo, mockRealtime);

    const created = await service.createPackage({
        name: "Gói Tạm",
        diamondAmount: 50,
        price: 10000,
    });

    await service.deletePackage(created.id);
    const remaining = await service.getPackages();
    assert.equal(remaining.length, 0);

    assert.equal(mockRealtime.events.length, 2);
    assert.deepEqual(mockRealtime.events[1], {
        type: "DIAMOND_PACKAGE_UPDATED",
        action: "DELETED",
        packageId: created.id,
    });

    await assert.rejects(
        () => service.deletePackage(created.id),
        (err: unknown) => err instanceof AppError && err.code === "DIAMOND_PACKAGE_NOT_FOUND",
    );
});

test("RealtimeService.broadcast sends SSE payload to all registered clients", () => {
    const realtime = new RealtimeService();
    const messages1: string[] = [];
    const messages2: string[] = [];

    const mockRes1 = {
        setHeader: () => {},
        flushHeaders: () => {},
        write: (chunk: string) => { messages1.push(chunk); },
    } as any;
    const mockReq1 = { on: () => {} } as any;

    const mockRes2 = {
        setHeader: () => {},
        flushHeaders: () => {},
        write: (chunk: string) => { messages2.push(chunk); },
    } as any;
    const mockReq2 = { on: () => {} } as any;

    realtime.registerClient("userA", mockReq1, mockRes1);
    realtime.registerClient("userB", mockReq2, mockRes2);

    // Initial CONNECTED sent on registerClient
    assert.equal(messages1.length, 1);
    assert.equal(messages2.length, 1);

    realtime.broadcast({
        type: "DIAMOND_PACKAGE_UPDATED",
        action: "CREATED",
        packageId: "pkg-99",
    });

    assert.equal(messages1.length, 2);
    assert.equal(messages2.length, 2);
    assert.equal(
        messages1[1],
        `data: ${JSON.stringify({ type: "DIAMOND_PACKAGE_UPDATED", action: "CREATED", packageId: "pkg-99" })}\n\n`,
    );
    assert.equal(
        messages2[1],
        `data: ${JSON.stringify({ type: "DIAMOND_PACKAGE_UPDATED", action: "CREATED", packageId: "pkg-99" })}\n\n`,
    );
});

test("GET /shop only returns ACTIVE packages, excludes INACTIVE, and sorts by orderIndex ASC", async () => {
    const repo = new InMemoryDiamondPackageRepository();
    await repo.create({
        code: "PKG_3",
        name: "Kho Báu Hoàng Gia",
        diamondAmount: 1000,
        bonusDiamond: 200,
        price: 99000,
        status: "ACTIVE",
        orderIndex: 3,
    });
    await repo.create({
        code: "PKG_INACTIVE",
        name: "Gói Ẩn Không Bán",
        diamondAmount: 300,
        bonusDiamond: 0,
        price: 30000,
        status: "INACTIVE",
        orderIndex: 1,
    });
    await repo.create({
        code: "PKG_1",
        name: "Túi Đá Quý",
        diamondAmount: 100,
        bonusDiamond: 0,
        price: 19000,
        status: "ACTIVE",
        orderIndex: 1,
    });
    await repo.create({
        code: "PKG_2",
        name: "Rương Bạc",
        diamondAmount: 500,
        bonusDiamond: 50,
        price: 49000,
        status: "ACTIVE",
        orderIndex: 2,
    });

    const fakeUserRepo = {} as IUserRepository;
    const fakeHeartService = {
        syncUserHearts: async (_userId: string) => ({
            id: "user1",
            status: "ACTIVE" as const,
            stats: {
                currentHeart: 5,
                maxHeart: 5,
                diamond: 100,
                nextHeartAt: null,
            },
        }),
    } as unknown as HeartService;
    const fakeDiamondTxRepo = {} as IDiamondTransactionRepository;

    const shopService = new ShopService(fakeUserRepo, fakeHeartService, fakeDiamondTxRepo, repo);
    const shopData = await shopService.getShop("user1");

    // Must only have 3 active packages (INACTIVE package excluded)
    assert.equal(shopData.diamondPackages.length, 3);

    // Must be sorted by orderIndex ASC (1, 2, 3)
    assert.equal(shopData.diamondPackages[0]!.name, "Túi Đá Quý");
    assert.equal(shopData.diamondPackages[0]!.orderIndex, 1);
    assert.equal(shopData.diamondPackages[1]!.name, "Rương Bạc");
    assert.equal(shopData.diamondPackages[1]!.orderIndex, 2);
    assert.equal(shopData.diamondPackages[2]!.name, "Kho Báu Hoàng Gia");
    assert.equal(shopData.diamondPackages[2]!.orderIndex, 3);

    // Total diamonds calculated properly
    assert.equal(shopData.diamondPackages[1]!.totalDiamond, 550);
    assert.equal(shopData.diamondPackages[2]!.totalDiamond, 1200);

    // Internal code should not be in ShopDiamondPackage
    assert.equal((shopData.diamondPackages[0] as any).code, undefined);
});
