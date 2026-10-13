import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import mongoose from "mongoose";
import { env } from "./config/env";
import { authRouter } from "./routes/auth.routes";
import { campaignRouter } from "./routes/campaign.routes";
import { submissionRouter } from "./routes/submission.routes";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

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

  app.use(express.json());

  const DB_STATES: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

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

  app.use((_req: Request, res: Response) => {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  // Four args are required for Express to treat this as an error handler.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      return res
        .status(err.statusCode)
        .json({ error: { code: err.code, message: err.message } });
    }
    console.error("Unhandled error:", err);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  });

  return app;
}
