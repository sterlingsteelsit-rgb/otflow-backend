import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { User } from "../models/user.model.js";

export type AuthedUser = {
  id: string;
  email: string;
  username: string;
  canApprove: boolean;
  isActive: boolean;
  role: { id: string; name: string; permissions: string[] };
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
      throw new HttpError(401, "Unauthorized");
    const token = header.slice("Bearer ".length);

    const payload = verifyAccessToken<{ sub: string }>(token);

    const user = await User.findById(payload.sub).populate("roleId").lean<{
      _id: any;
      email: string;
      username: string;
      canApprove: boolean;
      isActive: boolean;
      roleId: any;
    }>();

    if (!user) throw new HttpError(401, "Unauthorized");
    if (!user.isActive) throw new HttpError(403, "Account disabled");

    const role = user.roleId;
    req.user = {
      id: String(user._id),
      email: user.email,
      username: user.username,
      canApprove: user.canApprove,
      isActive: user.isActive,
      role: {
        id: String(role._id),
        name: role.name,
        permissions: role.permissions ?? [],
      },
    };

    next();
  } catch (e) {
    next(e);
  }
}
