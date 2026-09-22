import "dotenv/config";
import mongoose from "mongoose";

// Stop application writes before applying. Never syncIndexes/drop unrelated indexes.
async function main() {
    if (!process.env.MONGODB_URI) throw new Error("Missing database configuration");
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    try {
        const collection = mongoose.connection.collection("paymenttransactions");
        const exists = await mongoose.connection.db!.listCollections({ name: "paymenttransactions" }).hasNext();
        const indexes = exists ? await collection.indexes() : [];
        const legacy = indexes.filter(index => index.unique && index.key.providerTransactionId === 1 && Object.keys(index.key).length === 1);
        const invalidMethods = await collection.countDocuments({ paymentMethod: { $nin: ["VNPAY", "SEPAY"] } });
        const duplicates = await collection.aggregate([
            { $match: { providerTransactionId: { $type: "string" } } },
            { $group: { _id: { method: "$paymentMethod", id: "$providerTransactionId" }, count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
            { $count: "count" },
        ]).next();
        console.info({ invalidMethods, duplicateProviderGroups: duplicates?.count ?? 0,
            legacyIndexes: legacy.map(index => index.name), apply: process.argv.includes("--apply") });
        if (invalidMethods || duplicates?.count) throw new Error("Resolve invalid legacy payments before migration");
        if (!process.argv.includes("--apply")) return;
        // Build and verify the replacement BEFORE dropping the old constraint.
        await collection.createIndex({ paymentMethod: 1, providerTransactionId: 1 }, {
            name: "uniq_payment_provider_transaction", unique: true,
            partialFilterExpression: { providerTransactionId: { $type: "string" } },
        });
        const replacement = (await collection.indexes()).find(index => index.name === "uniq_payment_provider_transaction");
        if (!replacement?.unique || replacement.key.paymentMethod !== 1 || replacement.key.providerTransactionId !== 1) {
            throw new Error("Replacement index is not ready");
        }
        for (const index of legacy) await collection.dropIndex(index.name!);
        console.info({ indexReady: true, removedLegacyIndexes: legacy.length, documentsChanged: 0 });
    } finally { await mongoose.disconnect(); }
}

void main().catch(() => {
    console.error("Payment provider index migration failed; check configuration, duplicate groups and database indexes.");
    process.exitCode = 1;
});
