import { Router, type IRouter } from "express";
import healthRouter from "./health";
import practiceRoutesRouter from "./practice-routes";
import familyRouter from "./family";
import driveDebriefRouter from "./drive-debrief";
import nextDrivePlanRouter from "./next-drive-plan";

const router: IRouter = Router();

router.use(healthRouter);
router.use(practiceRoutesRouter);
router.use(familyRouter);
router.use(driveDebriefRouter);
router.use(nextDrivePlanRouter);

export default router;
