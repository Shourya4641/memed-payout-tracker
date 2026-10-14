import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/errors";
import { HttpStatus } from "../config/constants";

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const msg = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return next(new AppError(HttpStatus.BadRequest, "VALIDATION_ERROR", msg));
    }
    req.body = result.data;
    return next();
  };
}
