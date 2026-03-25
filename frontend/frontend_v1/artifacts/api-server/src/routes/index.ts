import { Router, type IRouter } from "express";
import healthRouter from "./health";
import robotRouter from "./robot";
import missionsRouter from "./missions";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/robot", robotRouter);
router.use("/missions", missionsRouter);

export default router;
