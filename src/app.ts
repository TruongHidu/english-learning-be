import express from "express";
import cors from "cors";
import helmet from "helmet";

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

export default app;