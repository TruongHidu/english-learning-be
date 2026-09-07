import "dotenv/config";
import mongoose from "mongoose";

// Run with the application stopped. Native collection access avoids autoIndex
// building the new unique index before legacy duplicates are resolved.
async function main() {
    if (!process.env.MONGODB_URI) throw new Error("Missing database configuration");
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    try {
        const collection = mongoose.connection.collection("paymenttransactions");
        const now = new Date();
        const expired = await collection.countDocuments({ status: "PENDING", expiresAt: { $lte: now } });
        const duplicates = await collection.aggregate([
            { $match: { status: "PENDING", expiresAt: { $gt: now } } },
            { $group: { _id: "$userId", count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
            { $group: { _id: null, users: { $sum: 1 }, extras: { $sum: { $subtract: ["$count", 1] } } } },
        ]).next();
        console.info({ expired, duplicateUsers: duplicates?.users ?? 0, extraPending: duplicates?.extras ?? 0 });
        if (!process.argv.includes("--apply")) return;
        const expiration = await collection.updateMany(
            { status: "PENDING", expiresAt: { $lte: now } }, { $set: { status: "EXPIRED", updatedAt: now } });
        const cursor = collection.find({ status: "PENDING" }).sort({ userId: 1, createdAt: -1, _id: -1 });
        let previousUser: string | undefined;
        let cancelled = 0;
        for await (const payment of cursor) {
            const user = String(payment.userId);
            if (previousUser === user) {
                cancelled += (await collection.updateOne({ _id: payment._id, status: "PENDING" },
                    { $set: { status: "CANCELLED", updatedAt: now } })).modifiedCount;
            }
            previousUser = user;
        }
        await collection.createIndex({ userId: 1 }, { unique: true, name: "uniq_pending_payment_per_user",
            partialFilterExpression: { status: "PENDING" } });
        await collection.createIndex({ status: 1, expiresAt: 1 });
        console.info({ expired: expiration.modifiedCount, cancelled, indexReady: true });
    } finally { await mongoose.disconnect(); }
}
void main().catch(() => { console.error("Payment migration failed; check configuration and database indexes."); process.exitCode = 1; });
