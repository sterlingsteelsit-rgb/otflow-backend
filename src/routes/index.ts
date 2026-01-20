import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { usersRouter } from "./users.routes.js";
import { rolesRouter } from "./roles.routes.js";
import { employeesRouter } from "./employees.routes.js";
import { otRouter } from "./ot.routes.js";
import { tripleOtRouter } from "./tripleOt.routes.js";
import { auditRouter } from "./audit.routes.js";
import { decisionReasonRouter } from "./decisionReason.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/roles", rolesRouter);
apiRouter.use("/employees", employeesRouter);
apiRouter.use("/ot", otRouter);
apiRouter.use("/triple-ot", tripleOtRouter);
apiRouter.use("/audit", auditRouter);
apiRouter.use("/decision-reasons", decisionReasonRouter);
