import { Schema, model, type HydratedDocument } from "mongoose";

import { COURSE_STATUSES, type CourseStatus } from "../types/course.types.js";

export interface CoursePersistence {
    name: string;
    description?: string;
    level: string;
    thumbnailUrl?: string;
    status: CourseStatus;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
}

export type CourseDocument = HydratedDocument<CoursePersistence>;

const courseSchema = new Schema<CoursePersistence>(
    {
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
        level: {
            type: String,
            required: true,
            trim: true,
        },
        thumbnailUrl: {
            type: String,
            required: false,
            trim: true,
        },
        status: {
            type: String,
            enum: COURSE_STATUSES,
            default: "DRAFT",
            required: true,
            index: true,
        },
        orderIndex: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
            index: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

courseSchema.index({ status: 1, orderIndex: 1 });
courseSchema.index({ level: 1 });

export const CourseModel = model<CoursePersistence>("Course", courseSchema);
