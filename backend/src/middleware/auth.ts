import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../errors/errors";

export type Role = "brand" | "creator";
export interface AuthUser {
  id: string;
  role: Role;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "UNAUTHENTICATED", "Missing bearer token"));
  }
  try {
    req.user = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthUser;
    return next();
  } catch {
    return next(
      new AppError(401, "UNAUTHENTICATED", "Invalid or expired token"),
    );
  }
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user)
      return next(new AppError(401, "UNAUTHENTICATED", "Not authenticated"));
    if (req.user.role !== role) {
      return next(new AppError(403, "FORBIDDEN", `Requires ${role} role`));
    }
    return next();
  };
}
