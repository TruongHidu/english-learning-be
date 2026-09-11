import { AsyncLocalStorage } from "node:async_hooks";
import mongoose, { Schema } from "mongoose";

// Mongoose propagates this session to queries, aggregates and document writes.
mongoose.set("transactionAsyncLocalStorage", true);
const context = new AsyncLocalStorage<{ locked: boolean; afterCommit: Array<() => Promise<void>> }>();
const CurriculumLock = mongoose.model("CurriculumLock", new Schema({
    _id: String,
    revision: { type: Number, default: 0 },
}, { versionKey: false }));

/** Serialize admin content writes to prevent assignment/status write skew. Learner reads use snapshot isolation. */
export async function curriculumTransaction<T>(work: () => Promise<T>, serialize = true): Promise<T> {
    const current = context.getStore();
    if (current) {
        if (serialize && !current.locked) {
            await CurriculumLock.updateOne({ _id: "curriculum" }, { $inc: { revision: 1 } }, { upsert: true });
            current.locked = true;
        }
        return work();
    }
    if (serialize) await CurriculumLock.updateOne({ _id: "curriculum" }, { $setOnInsert: { revision: 0 } }, { upsert: true });
    let afterCommit: Array<() => Promise<void>> = [];
    const result = await mongoose.connection.transaction(async () => {
        // A transient transaction retry must discard callbacks from the failed attempt.
        afterCommit = [];
        return context.run({ locked: serialize, afterCommit }, async () => {
            if (serialize) await CurriculumLock.updateOne({ _id: "curriculum" }, { $inc: { revision: 1 } });
            return work();
        });
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    for (const callback of afterCommit) await callback();
    return result;
}

export function deferUntilCurriculumCommit(work: () => Promise<void>): boolean {
    const current = context.getStore();
    if (!current) return false;
    current.afterCommit.push(work);
    return true;
}

/** Keeps transaction boundaries at the composition root, including validation reads. */
export function transactionalMethods<T extends object>(target: T, methods: readonly (keyof T)[], serialize = true): T {
    return new Proxy(target, {
        get(instance, key, receiver): unknown {
            const value: unknown = Reflect.get(instance, key, receiver);
            if (typeof value !== "function") return value;
            return (...args: unknown[]) => methods.includes(key as keyof T)
                ? curriculumTransaction(() => Reflect.apply(value, instance, args), serialize)
                : Reflect.apply(value, instance, args);
        },
    });
}
