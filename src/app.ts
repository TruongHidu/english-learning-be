import express from "express";
import cors from "cors";
import helmet from "helmet";

import { errorHandler } from "./middlewares/error.middleware.js";
import adminCourseRouter from "./routes/admin-course.routes.js";
import adminSectionRouter from "./routes/admin-section.routes.js";
import adminTopicRouter from "./routes/admin-topic.routes.js";
import adminLessonRouter from "./routes/admin-lesson.routes.js";
import authRouter from "./routes/auth.routes.js";
import courseRouter from "./routes/course.routes.js";
import userRouter from "./routes/user.routes.js";

const app = express();

app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        credentials: true,
    }),
);

app.use(helmet());

app.use(express.json());

app.get("/api/v1/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "English Learning API is running",
    });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/courses", courseRouter);
app.use("/api/v1/admin/courses", adminCourseRouter);
app.use("/api/v1/admin/sections", adminSectionRouter);
app.use("/api/v1/admin", adminTopicRouter);
app.use("/api/v1/admin", adminLessonRouter);

app.use(errorHandler);

export default app;
