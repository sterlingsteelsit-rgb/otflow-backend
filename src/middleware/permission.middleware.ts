import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http.js";

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const perms = req.user?.role.permissions ?? [];
    if (!perms.includes(permission))
      return next(new HttpError(403, "Forbidden"));
    next();
  };
}
