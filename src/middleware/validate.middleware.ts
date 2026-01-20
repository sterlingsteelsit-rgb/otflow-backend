import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { HttpError } from "../utils/http.js";

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (!result.success) {
      return next(
        new HttpError(400, "Validation error", result.error.flatten()),
      );
    }
    // attach parsed if you want later:
    (req as any).parsed = result.data;
    next();
  };
}
