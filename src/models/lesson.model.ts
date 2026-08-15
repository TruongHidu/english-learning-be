import { Schema, model, type HydratedDocument, type Types } from "mongoose";

import { CONTENT_STATUSES, type ContentStatus } from "../types/course.types.js";

export interface LessonPersistence {
    topicId: Types.ObjectId;
    name: string;
    description?: string;
    orderIndex: number;
    requiredScore: number;
    questionCount: number;
    xpReward: number;
    diamondReward: number;
    status: ContentStatus;
    createdAt: Date;
    updatedAt: Date;
}

export type LessonDocument = HydratedDocument<LessonPersistence>;

const lessonSchema = new Schema<LessonPersistence>(
    {
        topicId: {
            type: Schema.Types.ObjectId,
            ref: "Topic",
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: false,
            trim: true,
        },
        orderIndex: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        requiredScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            default: 70,
        },
        questionCount: {
            type: Number,
            required: true,
            min: 1,
            max: 100,
            default: 10,
        },
        xpReward: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        diamondReward: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        status: {
            type: String,
            enum: CONTENT_STATUSES,
            default: "DRAFT",
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

lessonSchema.index({ topicId: 1, status: 1, orderIndex: 1 });
lessonSchema.index({ topicId: 1, orderIndex: 1 });

export const LessonModel = model<LessonPersistence>("Lesson", lessonSchema);
