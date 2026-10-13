import express, { type Request, type Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import { env } from "./config/env";
import { authRouter } from "./routes/auth.routes";
import { campaignRouter } from "./routes/campaign.routes";
import { submissionRouter } from "./routes/submission.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";

const DB_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export function createApp() {
  const app = express();

  const allowedOrigins = [env.FRONTEND_URL, "http://localhost:3000"];

  app.use(
    cors({
      origin(origin, callback) {
        // Allow tools with no Origin header (curl, Postman, server-to-server).
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // Vercel preview deployments get a different hostname on every push.
        if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin))
          return callback(null, true);
        return callback(new Error(`Origin not allowed by CORS: ${origin}`));
      },
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // Bounded body size: no endpoint here accepts anything close to 10 kB.
  app.use(express.json({ limit: "10kb" }));
  app.use(requestLogger);

  // Always 200 so the service stays reachable and diagnosable even when Mongo is down.
  app.get("/health", (_req: Request, res: Response) => {
    const state = mongoose.connection.readyState;
    res.status(200).json({
      ok: true,
      db: DB_STATES[state] ?? "unknown",
      dbName: mongoose.connection.name,
      env: env.NODE_ENV,
      uptime: Math.round(process.uptime()),
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/campaigns", campaignRouter);
  app.use("/api/submissions", submissionRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
