import express from "express";
const router = express.Router();
import * as orderCtrl from "../controllers/order.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";


router.use(authenticate);

router.post("/", orderCtrl.createOrder);

router.get("/", orderCtrl.getOrders);

router.get("/:id", orderCtrl.getOrderById);

router.put("/:id/cancel", orderCtrl.cancelOrder);


export default router;