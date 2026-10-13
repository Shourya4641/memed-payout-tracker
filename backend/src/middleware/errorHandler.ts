import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/errors";

export function notFoundHandler(_req: Request, res: Response) {
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

/** Four parameters are required for Express to treat this as an error handler. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json({ error: { code: err.code, message: err.message } });
  }

  // Never leak a stack trace or driver message to the client.
  console.error("Unhandled error:", err);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
}
