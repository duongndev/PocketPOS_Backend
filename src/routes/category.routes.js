import express from 'express';
import * as categoryCtrl from '../controllers/category.controller.js';
import { catchAsync } from '../middlewares/errorHandler.middleware.js';
const router = express.Router();

/**
 * @desc    Lấy tất cả danh mục
 * @route   GET /api/categories
 */
router.get('/', catchAsync(categoryCtrl.getCategories));

/**
 * @desc    Lấy danh mục theo ID
 * @route   GET /api/categories/:id
 */
router.get('/:id', catchAsync(categoryCtrl.getCategoryById));

/**
 * @desc    Lấy cây danh mục
 * @route   GET /api/categories/tree
 */
router.get('/tree', catchAsync(categoryCtrl.getCategoryTree));

/**
 * @desc    Tạo danh mục mới
 * @route   POST /api/categories
 */
router.post('/', catchAsync(categoryCtrl.createCategory));

/**
 * @desc    Cập nhật danh mục
 * @route   PUT /api/categories/:id
 */
router.put('/:id', catchAsync(categoryCtrl.updateCategory));

/**
 * @desc    Xóa mềm danh mục (vô hiệu hóa)
 * @route   DELETE /api/categories/:id
 */
router.delete('/:id', catchAsync(categoryCtrl.deleteCategory));

/**
 * @desc    Kiểm tra ràng buộc trước khi xóa danh mục
 * @route   GET /api/categories/:id/constraints
 */
router.get('/:id/constraints', catchAsync(categoryCtrl.checkCategoryDeleteConstraints));

/**
 * @desc    Khôi phục danh mục đã xóa mềm
 * @route   POST /api/categories/:id/restore
 */
router.post('/:id/restore', catchAsync(categoryCtrl.restoreCategory));


/**
 * @desc    Xóa cứng danh mục (xóa vĩnh viễn)
 * @route   DELETE /api/categories/:id/hard
 */
router.delete('/:id/hard', catchAsync(categoryCtrl.hardDeleteCategory));

/**
 * @desc    Lấy thống kê danh mục
 * @route   GET /api/categories/stats/overview
 */
router.get('/stats/overview', catchAsync(categoryCtrl.getCategoryStats));

export default router;
