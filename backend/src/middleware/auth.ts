import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../errors/errors";
import { HttpStatus, Role } from "../config/constants";

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(
      new AppError(
        HttpStatus.Unauthorized,
        "UNAUTHENTICATED",
        "Missing bearer token",
      ),
    );
  }
  try {
    req.user = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthUser;
    return next();
  } catch {
    return next(
      new AppError(
        HttpStatus.Unauthorized,
        "UNAUTHENTICATED",
        "Invalid or expired token",
      ),
    );
  }
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user)
      return next(
        new AppError(
          HttpStatus.Unauthorized,
          "UNAUTHENTICATED",
          "Not authenticated",
        ),
      );
    if (req.user.role !== role) {
      return next(
        new AppError(
          HttpStatus.Forbidden,
          "FORBIDDEN",
          `Requires ${role} role`,
        ),
      );
    }
    return next();
  };
}
