import express from "express";
import { sepayWebhook } from "../controllers/webhook.controller.js";

const router = express.Router();

router.post("/sepay", sepayWebhook);

export default router;