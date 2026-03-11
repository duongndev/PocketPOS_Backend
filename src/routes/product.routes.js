import express from "express";
const router = express.Router();
import {
  createProduct,
  getProducts,
  getProductById,
  getProductByBarcode,
  updateProduct,
  deleteProduct,
  hardDeleteProduct,
  restoreProduct,
  updateProductStock
} from "../controllers/product.controller.js";
import {validateProduct} from "../middlewares/validation.middleware.js";
import { generalRateLimit } from '../middlewares/rateLimiting.middleware.js';
import { catchAsync } from '../middlewares/errorHandler.middleware.js';

// Áp dụng rate limiting cho tất cả routes
router.use(generalRateLimit);

/**
 * @desc    Tạo sản phẩm mới
 * @route   POST /api/products
 * @access  Private (Admin/Manager)
 */
router.post('/', validateProduct, catchAsync(createProduct));

/**
 * @desc    Lấy tất cả sản phẩm (với bộ lọc, tìm kiếm, phân trang)
 * @route   GET /api/products
 * @access  Public
 */
router.get('/', catchAsync(getProducts));

/**
 * @desc    Lấy sản phẩm theo ID
 * @route   GET /api/products/:id
 * @access  Public
 */
router.get('/:id', catchAsync(getProductById));

/**
 * @desc    Lấy sản phẩm theo mã vạch
 * @route   GET /api/products/barcode/:barcode
 * @access  Public
 */
router.get('/barcode/:barcode', catchAsync(getProductByBarcode));

/**
 * @desc    Cập nhật sản phẩm
 * @route   PUT /api/products/:id
 * @access  Private (Admin/Manager)
 */
router.put('/:id', validateProduct, catchAsync(updateProduct));

/**
 * @desc    Xóa mềm sản phẩm (vô hiệu hóa)
 * @route   DELETE /api/products/:id
 * @access  Private (Admin/Manager)
 */
router.delete('/:id', catchAsync(deleteProduct));

/**
 * @desc    Xóa cứng sản phẩm (xóa vĩnh viễn)
 * @route   DELETE /api/products/hard/:id
 * @access  Private (Admin only)
 */
router.delete('/hard/:id', catchAsync(hardDeleteProduct));

/**
 * @desc    Khôi phục sản phẩm bị vô hiệu hóa
 * @route   POST /api/products/restore/:id
 * @access  Private (Admin/Manager)
 */
router.post('/restore/:id', catchAsync(restoreProduct));

/**
 * @desc    Cập nhật tồn kho sản phẩm
 * @route   PUT /api/products/stock/:id
 * @access  Private (Admin/Manager/Cashier)
 */
router.put('/stock/:id', catchAsync(updateProductStock));

export default router;
