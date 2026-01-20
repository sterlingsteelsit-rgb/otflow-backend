import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { env } from "../configs/env.js";
import * as Auth from "../services/auth.service.js";
import { HttpError } from "../utils/http.js";

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
  query: z.any(),
  params: z.any(),
});

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = (req as any).parsed.body;
    const result = await Auth.login(email, password);

    res.cookie(env.cookieName, result.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.nodeEnv === "production",
      path: "/api/auth/refresh",
    });

    res.json({ accessToken: result.accessToken, user: result.user });
  } catch (e) {
    next(e);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const rt = req.cookies?.[env.cookieName];
    if (!rt) throw new HttpError(401, "Missing refresh token");

    const result = await Auth.refresh(rt);

    res.cookie(env.cookieName, result.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.nodeEnv === "production",
      path: "/api/auth/refresh",
    });

    res.json({ accessToken: result.accessToken, user: result.user });
  } catch (e) {
    next(e);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const rt = req.cookies?.[env.cookieName];
    if (rt) await Auth.logout(rt);

    res.clearCookie(env.cookieName, { path: "/api/auth/refresh" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function me(req: Request, res: Response) {
  res.json({ user: req.user });
}
