import type { Request, Response, NextFunction } from "express";
import { isValidObjectId } from "mongoose";
import { AppError } from "../errors/errors";

/**
 * Rejects malformed route params before Mongoose throws a CastError,
 * which would otherwise surface as a 500 for what is a client error.
 */
export function validateObjectId(param = "id") {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!isValidObjectId(String(req.params[param]))) {
      return next(new AppError(400, "INVALID_ID", `Invalid ${param}`));
    }
    return next();
  };
}
