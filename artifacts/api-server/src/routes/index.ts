import { Router, type IRouter } from "express";
import healthRouter from "./health";
import practiceRoutesRouter from "./practice-routes";
import familyRouter from "./family";
import driveDebriefRouter from "./drive-debrief";

const router: IRouter = Router();

router.use(healthRouter);
router.use(practiceRoutesRouter);
router.use(familyRouter);
router.use(driveDebriefRouter);

export default router;
