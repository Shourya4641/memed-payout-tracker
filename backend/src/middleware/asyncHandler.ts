import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Express does not catch rejected promises from async handlers — an unhandled
 * rejection crashes the process instead of reaching the error middleware.
 * Wrapping forwards any rejection to next(), so routes contain no try/catch.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}
