import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { AppError } from "../errors/errors";
import { User } from "../models/User";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";

const signupSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["brand", "creator"]),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

type TokenSubject = { id: string; role: string; email: string };
function issueToken(user: TokenSubject) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions,
  );
}

function authResponse(user: TokenSubject & { name: string }) {
  return {
    token: issueToken(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

export const authRouter = Router();

authRouter.post(
  "/signup",
  validateBody(signupSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    if (await User.exists({ email })) {
      throw new AppError(
        409,
        "EMAIL_TAKEN",
        "An account with that email already exists",
      );
    }

    const user = await User.create({
      name,
      email,
      role,
      passwordHash: await bcrypt.hash(password, 10),
    });

    res.status(201).json(authResponse(user));
  }),
);

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    // Same error for unknown email and wrong password — don't leak which accounts exist.
    const ok = user && (await bcrypt.compare(password, user.passwordHash));

    if (!ok) {
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password",
      );
    }

    res.json(authResponse(user));
  }),
);
