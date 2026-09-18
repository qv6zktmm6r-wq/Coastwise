import { Router, type IRouter } from "express";
import healthRouter from "./health";
import practiceRoutesRouter from "./practice-routes";
import familyRouter from "./family";

const router: IRouter = Router();

router.use(healthRouter);
router.use(practiceRoutesRouter);
router.use(familyRouter);

export default router;
