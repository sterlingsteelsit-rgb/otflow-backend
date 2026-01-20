import { Router } from "express";
import { authLimiter } from "../middleware/rateLimit.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import * as Auth from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const authRouter = Router();

authRouter.post("/login", authLimiter, validate(Auth.loginSchema), Auth.login);
authRouter.post("/refresh", Auth.refresh);
authRouter.post("/logout", Auth.logout);
authRouter.get("/me", requireAuth, Auth.me);
