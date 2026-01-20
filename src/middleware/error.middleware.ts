import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http.js";
import { logger } from "../configs/logger.js";

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    return res
      .status(err.status)
      .json({ message: err.message, details: err.details });
  }

  logger.error({ err }, "Unhandled error");
  return res.status(500).json({ message: "Internal server error" });
}
