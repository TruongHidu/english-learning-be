import { Schema, model, type Types } from "mongoose";

export interface CurriculumMilestone {
    userId: Types.ObjectId;
    targetId: Types.ObjectId;
    kind: "LESSON" | "TOPIC" | "SECTION";
    accessGrantedAt: Date;
    firstCompletedAt?: Date;
    /** Curriculum membership at first completion, retained when new lessons arrive. */
    completedLessonIds?: Types.ObjectId[];
}
const schema = new Schema<CurriculumMilestone>({
    userId: { type: Schema.Types.ObjectId, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["LESSON", "TOPIC", "SECTION"], required: true },
    accessGrantedAt: { type: Date, required: true },
    firstCompletedAt: Date,
    completedLessonIds: { type: [Schema.Types.ObjectId], default: undefined },
}, { timestamps: true, versionKey: false });
schema.index({ userId: 1, kind: 1, targetId: 1 }, { unique: true });
export const UserCurriculumMilestoneModel = model<CurriculumMilestone>("UserCurriculumMilestone", schema);
