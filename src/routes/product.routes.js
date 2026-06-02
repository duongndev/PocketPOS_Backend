import express from "express";
const router = express.Router();
import * as productCtrl from "../controllers/product.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

router.use(authenticate);


router.post("/", productCtrl.createProduct);

router.get("/", productCtrl.getProducts);

router.get(
  "/barcode/:barcode",
  productCtrl.getProductByBarcode
);

router.get("/:id", productCtrl.getProductById);

router.put("/:id", productCtrl.updateProduct);

router.delete("/:id", productCtrl.deleteProduct);


export default router;
