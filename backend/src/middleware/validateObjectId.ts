import type { Request, Response, NextFunction } from "express";
import { isValidObjectId } from "mongoose";
import { AppError } from "../errors/errors";
import { HttpStatus } from "../config/constants";

/**
 * Rejects malformed route params.
 */
export function validateObjectId(param = "id") {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!isValidObjectId(String(req.params[param]))) {
      return next(
        new AppError(HttpStatus.BadRequest, "INVALID_ID", `Invalid ${param}`),
      );
    }
    return next();
  };
}
