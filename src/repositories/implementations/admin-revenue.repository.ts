import type { Types } from "mongoose";
import { PaymentTransactionModel } from "../../models/payment-transaction.model.js";
import type { AdminRevenueRecentPayment } from "../../types/admin-revenue.types.js";
import type {
    IAdminRevenueRepository,
    RevenueSummaryRaw,
    TopPackageRaw,
} from "../interfaces/admin-revenue.repository.interface.js";

interface PopulatedUser {
    _id: Types.ObjectId;
    displayName?: string;
    email?: string;
}

export class AdminRevenueRepository implements IAdminRevenueRepository {
    async getSummary(monthStartUtc: Date, nextMonthStartUtc: Date): Promise<RevenueSummaryRaw> {
        const defaultSummary: RevenueSummaryRaw = {
            totalRevenue: 0,
            currentMonthRevenue: 0,
            totalPayments: 0,
            successfulPayments: 0,
            pendingPayments: 0,
            failedPayments: 0,
            cancelledPayments: 0,
            expiredPayments: 0,
        };

        const result = await PaymentTransactionModel.aggregate<{
            totalStats: RevenueSummaryRaw[];
        }>([
            {
                $facet: {
                    totalStats: [
                        {
                            $group: {
                                _id: null,
                                totalRevenue: {
                                    $sum: {
                                        $cond: [{ $eq: ["$status", "SUCCESS"] }, "$amount", 0],
                                    },
                                },
                                currentMonthRevenue: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $eq: ["$status", "SUCCESS"] },
                                                    {
                                                        $cond: [
                                                            { $ne: [{ $ifNull: ["$paidAt", null] }, null] },
                                                            {
                                                                $and: [
                                                                    { $gte: ["$paidAt", monthStartUtc] },
                                                                    { $lt: ["$paidAt", nextMonthStartUtc] },
                                                                ],
                                                            },
                                                            // Legacy fallback only.
                                                            // SUCCESS transactions created by the current payment flow should normally have paidAt.
                                                            // createdAt is used only for historical records that lack paidAt.
                                                            {
                                                                $and: [
                                                                    { $gte: ["$createdAt", monthStartUtc] },
                                                                    { $lt: ["$createdAt", nextMonthStartUtc] },
                                                                ],
                                                            },
                                                        ],
                                                    },
                                                ],
                                            },
                                            "$amount",
                                            0,
                                        ],
                                    },
                                },
                                totalPayments: { $sum: 1 },
                                successfulPayments: {
                                    $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] },
                                },
                                pendingPayments: {
                                    $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] },
                                },
                                failedPayments: {
                                    $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
                                },
                                cancelledPayments: {
                                    $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] },
                                },
                                expiredPayments: {
                                    $sum: { $cond: [{ $eq: ["$status", "EXPIRED"] }, 1, 0] },
                                },
                            },
                        },
                    ],
                },
            },
        ]).exec();

        const row = result[0]?.totalStats[0];
        if (!row) return defaultSummary;

        return {
            totalRevenue: row.totalRevenue ?? 0,
            currentMonthRevenue: row.currentMonthRevenue ?? 0,
            totalPayments: row.totalPayments ?? 0,
            successfulPayments: row.successfulPayments ?? 0,
            pendingPayments: row.pendingPayments ?? 0,
            failedPayments: row.failedPayments ?? 0,
            cancelledPayments: row.cancelledPayments ?? 0,
            expiredPayments: row.expiredPayments ?? 0,
        };
    }

    async getTopPackages(limit = 5): Promise<TopPackageRaw[]> {
        const rows = await PaymentTransactionModel.aggregate<TopPackageRaw>([
            { $match: { status: "SUCCESS" } },
            // Sort by createdAt descending first so $first picks the newest snapshot deterministically
            { $sort: { createdAt: -1, _id: -1 } },
            {
                $group: {
                    _id: "$packageCodeSnapshot",
                    packageName: { $first: "$packageNameSnapshot" },
                    successfulPayments: { $sum: 1 },
                    totalRevenue: { $sum: "$amount" },
                    totalDiamonds: { $sum: "$diamondAmount" },
                },
            },
            // Tie-break with _id for strict determinism
            { $sort: { totalRevenue: -1, _id: 1 } },
            { $limit: limit },
            {
                $project: {
                    _id: 0,
                    packageCode: "$_id",
                    packageName: 1,
                    successfulPayments: 1,
                    totalRevenue: 1,
                    totalDiamonds: 1,
                },
            },
        ]).exec();

        return rows;
    }

    async getRecentPayments(limit = 10): Promise<AdminRevenueRecentPayment[]> {
        const docs = await PaymentTransactionModel.find()
            .sort({ createdAt: -1, _id: -1 })
            .limit(limit)
            .populate<{ userId: PopulatedUser | null }>({
                path: "userId",
                select: "displayName email",
            })
            .lean()
            .exec();

        return docs.map((doc): AdminRevenueRecentPayment => {
            const userDoc =
                doc.userId && typeof doc.userId === "object" && "_id" in doc.userId
                    ? doc.userId
                    : null;

            return {
                id: doc._id.toString(),
                transactionCode: doc.transactionCode,
                user: userDoc
                    ? {
                          id: userDoc._id.toString(),
                          displayName: userDoc.displayName || "Người dùng",
                          email: userDoc.email || "",
                      }
                    : null,
                packageName: doc.packageNameSnapshot,
                diamondAmount: doc.diamondAmount,
                amount: doc.amount,
                currency: "VND",
                status: doc.status,
                createdAt:
                    doc.createdAt instanceof Date
                        ? doc.createdAt.toISOString()
                        : new Date(doc.createdAt).toISOString(),
                paidAt: doc.paidAt
                    ? doc.paidAt instanceof Date
                        ? doc.paidAt.toISOString()
                        : new Date(doc.paidAt).toISOString()
                    : null,
            };
        });
    }
}
