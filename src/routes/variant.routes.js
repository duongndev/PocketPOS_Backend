import express from "express";
const router = express.Router();
import * as variantCtrl from "../controllers/variant.controller.js";
import { validateVariant, validateVariantStockUpdate, validateVariantId, validateProductId } from "../middlewares/validation.middleware.js";
import { generalRateLimit } from '../middlewares/rateLimiting.middleware.js';
import { catchAsync } from '../middlewares/errorHandler.middleware.js';

// Áp dụng rate limiting cho tất cả routes
router.use(generalRateLimit);

/**
 * @desc    Lấy danh sách tất cả sản phẩm biến thể (với bộ lọc, tìm kiếm, phân trang)
 * @route   GET /api/variants
 * @access  Public
 */
router.get('/', catchAsync(variantCtrl.getAllVariants));

/**
 * @desc    Lấy danh sách biến thể của một sản phẩm
 * @route   GET /api/variants/product/:productId
 * @access  Public
 */
router.get('/product/:productId', validateProductId, catchAsync(variantCtrl.getProductVariants));

/**
 * @desc    Thêm variant mới
 * @route   POST /api/variants
 * @access  Private (Admin/Manager)
 */
router.post('/', validateVariant, catchAsync(variantCtrl.addProductVariant));

/**
 * @desc    Cập nhật variant
 * @route   PUT /api/variants/:id
 * @access  Private (Admin/Manager)
 */
router.put('/:id', validateVariantId, validateVariant, catchAsync(variantCtrl.updateProductVariant));

/**
 * @desc    Cập nhật tồn kho variant
 * @route   PATCH /api/variants/:id/stock
 * @access  Private (Admin/Manager/Cashier)
 */
router.patch('/:id/stock', validateVariantId, validateVariantStockUpdate, catchAsync(variantCtrl.updateVariantStock));

/**
 * @desc    Xóa variant
 * @route   DELETE /api/variants/:id
 * @access  Private (Admin/Manager)
 */
router.delete('/:id', validateVariantId, catchAsync(variantCtrl.deleteProductVariant));

export default router;
