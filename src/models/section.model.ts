import { Schema, model, type HydratedDocument, type Types } from "mongoose";

import { SECTION_STATUSES, type SectionStatus } from "../types/section.types.js";

export interface SectionPersistence {
    courseId: Types.ObjectId;
    name: string;
    description?: string;
    orderIndex: number;
    status: SectionStatus;
    createdAt: Date;
    updatedAt: Date;
}

export type SectionDocument = HydratedDocument<SectionPersistence>;

const sectionSchema = new Schema<SectionPersistence>(
    {
        courseId: {
            type: Schema.Types.ObjectId,
            ref: "Course",
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
        status: {
            type: String,
            enum: SECTION_STATUSES,
            default: "DRAFT",
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

sectionSchema.index({ courseId: 1, status: 1, orderIndex: 1 });
sectionSchema.index({ courseId: 1, orderIndex: 1 });

export const SectionModel = model<SectionPersistence>("Section", sectionSchema);
