import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export interface LessonQuestionPersistence {
    lessonId: Types.ObjectId;
    questionId: Types.ObjectId;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
}

export type LessonQuestionDocument = HydratedDocument<LessonQuestionPersistence>;

const lessonQuestionSchema = new Schema<LessonQuestionPersistence>(
    {
        lessonId: {
            type: Schema.Types.ObjectId,
            ref: "Lesson",
            required: true,
            index: true,
        },
        questionId: {
            type: Schema.Types.ObjectId,
            ref: "Question",
            required: true,
            index: true,
        },
        orderIndex: {
            type: Number,
            required: true,
            default: 1,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

lessonQuestionSchema.index({ lessonId: 1, questionId: 1 }, { unique: true });
lessonQuestionSchema.index({ lessonId: 1, orderIndex: 1 });

export const LessonQuestionModel = model<LessonQuestionPersistence>(
    "LessonQuestion",
    lessonQuestionSchema,
);
