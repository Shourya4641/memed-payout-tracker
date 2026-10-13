import type { Request, Response, NextFunction } from "express";

/**
 * Minimal access log. Deliberately not a logging library: nothing consumes
 * structured logs here, and Render's console is the only reader.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`,
    );
  });
  next();
}
