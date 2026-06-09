import express from "express";
const router = express.Router();
import { sepayWebhook } from "../controllers/webhook.controller.js";
import { sepayHmac } from "../middlewares/sepayHmac.middleware.js";

router.post("/sepay", sepayHmac, sepayWebhook);

export default router;