import { Router, type IRouter } from "express";
import healthRouter from "./health";
import practiceRoutesRouter from "./practice-routes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(practiceRoutesRouter);

export default router;
