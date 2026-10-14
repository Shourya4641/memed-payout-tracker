import express, { type Request, type Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import { env } from "./config/env";
import { authRouter } from "./routes/auth.routes";
import { campaignRouter } from "./routes/campaign.routes";
import { submissionRouter } from "./routes/submission.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { DbState, HttpStatus } from "./config/constants";

export function createApp() {
  const app = express();

  const allowedOrigins = [env.FRONTEND_URL, "http://localhost:3000"];

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin))
          return callback(null, true);
        return callback(new Error(`Origin not allowed by CORS: ${origin}`));
      },
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (_req: Request, res: Response) => {
    const state = mongoose.connection.readyState;
    res.status(HttpStatus.Ok).json({
      ok: true,
      db: DbState[state]?.toLowerCase() ?? "unknown",
      dbName: mongoose.connection.name,
      env: env.NODE_ENV,
      uptime: Math.round(process.uptime()),
    });
  });

  app.use(requestLogger);
  app.use("/api/auth", authRouter);
  app.use("/api/campaigns", campaignRouter);
  app.use("/api/submissions", submissionRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
