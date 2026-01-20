import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../configs/env.js";

export function signAccessToken(payload: object) {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: `${env.accessTokenTtlMin}m`,
  });
}

export function signRefreshToken(payload: object) {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: `${env.refreshTokenTtlDays}d`,
  });
}

export function verifyAccessToken<T>(token: string): T {
  return jwt.verify(token, env.jwtAccessSecret) as T;
}

export function verifyRefreshToken<T>(token: string): T {
  return jwt.verify(token, env.jwtRefreshSecret) as T;
}

export function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
