import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/errors";
import { HttpStatus } from "../config/constants";

export function notFoundHandler(_req: Request, res: Response) {
  res
    .status(HttpStatus.NotFound)
    .json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

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

  console.error("Unhandled error:", err);
  return res.status(HttpStatus.InternalServerError).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
}
