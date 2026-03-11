import express from "express";
const router = express.Router();
import * as productCtrl from "../controllers/product.controller.js";
import {validateProduct, validateProductUpdate, validateVariant, validateVariantStockUpdate, validateProductVariantIds, validateProductId} from "../middlewares/validation.middleware.js";
import { generalRateLimit } from '../middlewares/rateLimiting.middleware.js';
import { catchAsync } from '../middlewares/errorHandler.middleware.js';

// Áp dụng rate limiting cho tất cả routes
router.use(generalRateLimit);

/**
 * @desc    Tạo sản phẩm mới
 * @route   POST /api/products
 * @access  Private (Admin/Manager)
 */
router.post('/', validateProduct, catchAsync(productCtrl.createProduct));

/**
 * @desc    Lấy tất cả sản phẩm (với bộ lọc, tìm kiếm, phân trang)
 * @route   GET /api/products
 * @access  Public
 */
router.get('/', catchAsync(productCtrl.getProducts));

/**
 * @desc    Lấy sản phẩm theo ID
 * @route   GET /api/products/:id
 * @access  Public
 */
router.get('/:id', validateProductId, catchAsync(productCtrl.getProductById));

/**
 * @desc    Lấy sản phẩm theo mã vạch
 * @route   GET /api/products/barcode/:barcode
 * @access  Public
 */
router.get('/barcode/:barcode', catchAsync(productCtrl.getProductByBarcode));

/**
 * @desc    Cập nhật sản phẩm
 * @route   PUT /api/products/:id
 * @access  Private (Admin/Manager)
 */
router.put('/:id', validateProductId, validateProductUpdate, catchAsync(productCtrl.updateProduct));

/**
 * @desc    Xóa mềm sản phẩm (vô hiệu hóa)
 * @route   DELETE /api/products/:id
 * @access  Private (Admin/Manager)
 */
router.delete('/:id', validateProductId, catchAsync(productCtrl.deleteProduct));

/**
 * @desc    Xóa cứng sản phẩm (xóa vĩnh viễn)
 * @route   DELETE /api/products/hard/:id
 * @access  Private (Admin only)
 */
router.delete('/hard/:id', validateProductId, catchAsync(productCtrl.hardDeleteProduct));

/**
 * @desc    Khôi phục sản phẩm bị vô hiệu hóa
 * @route   POST /api/products/:id/restore
 * @access  Private (Admin/Manager)
 */
router.post('/:id/restore', validateProductId, catchAsync(productCtrl.restoreProduct));

/**
 * @desc    Thêm variant cho sản phẩm
 * @route   POST /api/products/:id/variants
 * @access  Private (Admin/Manager)
 */
router.post('/:id/variants', validateProductId, validateVariant, catchAsync(productCtrl.addProductVariant));

/**
 * @desc    Cập nhật variant
 * @route   PUT /api/products/:productId/variants/:variantId
 * @access  Private (Admin/Manager)
 */
router.put('/:productId/variants/:variantId', validateProductVariantIds, validateVariant, catchAsync(productCtrl.updateProductVariant));

/**
 * @desc    Cập nhật tồn kho variant
 * @route   PATCH /api/products/:productId/variants/:variantId/stock
 * @access  Private (Admin/Manager/Cashier)
 */
router.patch('/:productId/variants/:variantId/stock', validateProductVariantIds, validateVariantStockUpdate, catchAsync(productCtrl.updateVariantStock));

/**
 * @desc    Xóa variant
 * @route   DELETE /api/products/:productId/variants/:variantId
 * @access  Private (Admin/Manager)
 */
router.delete('/:productId/variants/:variantId', validateProductVariantIds, catchAsync(productCtrl.deleteProductVariant));

export default router;
