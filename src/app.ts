import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { corsOptions } from "./configs/cors.js";
import { apiRouter } from "./routes";
import { errorMiddleware } from "./middleware/error.middleware.js";

export function createApp() {
  const app = express();
  let setDelay = false;

  if (process.env.NODE_ENV === "development" && setDelay) {
    console.log("Development mode: Enabling artificial delay of 3s");
    app.use((req, res, next) => {
      setTimeout(next, 3000);
    });
  }

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api", apiRouter);

  app.use(errorMiddleware);
  return app;
}
