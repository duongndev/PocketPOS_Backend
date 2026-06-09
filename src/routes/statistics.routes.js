import express from "express";
const router = express.Router();
import * as statisticsCtrl from "../controllers/statistics.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

router.use(authenticate);

router.get("/dashboard", statisticsCtrl.getDashboardStatistics);

export default router;