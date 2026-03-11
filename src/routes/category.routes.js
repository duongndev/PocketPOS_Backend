import express from 'express';
const router = express.Router();
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  hardDeleteCategory,
  getCategoryStats
} from '../controllers/category.controller.js';
import { generalRateLimit } from '../middlewares/rateLimiting.middleware.js';
import { catchAsync } from '../middlewares/errorHandler.middleware.js';



/**
 * @desc    Tạo danh mục mới
 * @route   POST /api/categories
 * @access  Private (Admin/Manager)
 */
router.post('/', catchAsync(createCategory));

/**
 * @desc    Lấy tất cả danh mục
 * @route   GET /api/categories
 * @access  Public
 */
router.get('/', catchAsync(getCategories));

/**
 * @desc    Lấy danh mục theo ID
 * @route   GET /api/categories/:id
 * @access  Public
 */
router.get('/:id', catchAsync(getCategoryById));

/**
 * @desc    Cập nhật danh mục
 * @route   PUT /api/categories/:id
 * @access  Private (Admin/Manager)
 */
router.put('/:id', catchAsync(updateCategory));

/**
 * @desc    Xóa mềm danh mục (vô hiệu hóa)
 * @route   DELETE /api/categories/:id
 * @access  Private (Admin/Manager)
 */
router.delete('/:id', catchAsync(deleteCategory));

/**
 * @desc    Xóa cứng danh mục (xóa vĩnh viễn)
 * @route   DELETE /api/categories/:id/hard
 * @access  Private (Admin only)
 */
router.delete('/:id/hard', catchAsync(hardDeleteCategory));

/**
 * @desc    Lấy thống kê danh mục
 * @route   GET /api/categories/stats/overview
 * @access  Private (Admin/Manager)
 */
router.get('/stats/overview', catchAsync(getCategoryStats));

export default router;
