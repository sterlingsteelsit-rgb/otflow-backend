import { HttpError } from "../utils/http.js";
import { User } from "../models/user.model.js";
import { RefreshToken } from "../models/refreshToken.model.js";
import { verifyPassword } from "../utils/password.js";
import {
  signAccessToken,
  signRefreshToken,
  sha256,
  verifyRefreshToken,
} from "../utils/tokens.js";
import { env } from "../configs/env.js";

function refreshExpiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + env.refreshTokenTtlDays);
  return d;
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() }).populate(
    "roleId",
  );
  if (!user) throw new HttpError(401, "Invalid credentials");
  if (!user.isActive) throw new HttpError(403, "Account disabled");

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw new HttpError(401, "Invalid credentials");

  const accessToken = signAccessToken({ sub: String(user._id) });
  const refreshToken = signRefreshToken({ sub: String(user._id) });

  await RefreshToken.create({
    userId: user._id,
    tokenHash: sha256(refreshToken),
    expiresAt: refreshExpiryDate(),
  });

  const role: any = user.roleId;
  return {
    accessToken,
    refreshToken,
    user: {
      id: String(user._id),
      email: user.email,
      username: user.username,
      canApprove: user.canApprove,
      role: {
        id: String(role._id),
        name: role.name,
        permissions: role.permissions ?? [],
      },
    },
  };
}

export async function refresh(refreshToken: string) {
  const payload = verifyRefreshToken<{ sub: string }>(refreshToken);

  const tokenHash = sha256(refreshToken);
  const exists = await RefreshToken.findOne({ userId: payload.sub, tokenHash });
  if (!exists) throw new HttpError(401, "Invalid refresh token");

  // rotate: delete old, create new
  await RefreshToken.deleteOne({ _id: exists._id });

  const user = await User.findById(payload.sub).populate("roleId");
  if (!user) throw new HttpError(401, "Unauthorized");
  if (!user.isActive) throw new HttpError(403, "Account disabled");

  const newAccess = signAccessToken({ sub: String(user._id) });
  const newRefresh = signRefreshToken({ sub: String(user._id) });

  await RefreshToken.create({
    userId: user._id,
    tokenHash: sha256(newRefresh),
    expiresAt: refreshExpiryDate(),
  });

  const role: any = user.roleId;
  return {
    accessToken: newAccess,
    refreshToken: newRefresh,
    user: {
      id: String(user._id),
      email: user.email,
      username: user.username,
      canApprove: user.canApprove,
      role: {
        id: String(role._id),
        name: role.name,
        permissions: role.permissions ?? [],
      },
    },
  };
}

export async function logout(refreshToken: string) {
  try {
    const payload = verifyRefreshToken<{ sub: string }>(refreshToken);
    await RefreshToken.deleteMany({
      userId: payload.sub,
      tokenHash: sha256(refreshToken),
    });
  } catch {
    // ignore invalid token
  }
}
