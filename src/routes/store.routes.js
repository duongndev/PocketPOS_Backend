import express from "express";
const router = express.Router();
import * as storeCtrl from "../controllers/store.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

router.use(authenticate);

router.get("/me", storeCtrl.getStoreProfile);

router.put("/me", storeCtrl.updateStoreProfile);

router.put("/banking-info", storeCtrl.updateBankInfo);

router.patch("/me/status", storeCtrl.updateStoreStatus);

export default router;