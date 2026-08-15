import { Schema, model, type HydratedDocument, type Types } from "mongoose";

import { CONTENT_STATUSES, type ContentStatus } from "../types/course.types.js";

export interface TopicPersistence {
    sectionId: Types.ObjectId;
    name: string;
    description?: string;
    orderIndex: number;
    status: ContentStatus;
    createdAt: Date;
    updatedAt: Date;
}

export type TopicDocument = HydratedDocument<TopicPersistence>;

const topicSchema = new Schema<TopicPersistence>(
    {
        sectionId: {
            type: Schema.Types.ObjectId,
            ref: "Section",
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

topicSchema.index({ sectionId: 1, status: 1, orderIndex: 1 });
topicSchema.index({ sectionId: 1, orderIndex: 1 });

export const TopicModel = model<TopicPersistence>("Topic", topicSchema);
