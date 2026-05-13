import express from "express";
const router = express.Router();
import * as userCtrl from "../controllers/user.controller.js";
import { authenticate, isAdmin, canManage } from "../middlewares/auth.middleware.js";
import { catchAsync } from '../middlewares/errorHandler.middleware.js';

// ===== PUBLIC ROUTES =====

/**
 * @desc    Đăng ký người dùng mới
 * @route   POST /api/users/register
 * @access  Public
 */
router.post('/register', catchAsync(userCtrl.register));

/**
 * @desc    Đăng nhập
 * @route   POST /api/users/login
 * @access  Public
 */
router.post('/login', catchAsync(userCtrl.login));

// ===== PROTECTED ROUTES =====

/**
 * @desc    Lấy thông tin người dùng hiện tại
 * @route   GET /api/users/profile
 * @access  Private
 */
router.get('/profile', authenticate, catchAsync(userCtrl.getProfile));

/**
 * @desc    Cập nhật thông tin người dùng hiện tại
 * @route   PUT /api/users/profile
 * @access  Private
 */
router.put('/profile', authenticate, catchAsync(userCtrl.updateProfile));

/**
 * @desc    Đổi mật khẩu
 * @route   POST /api/users/change-password
 * @access  Private
 */
router.post('/change-password', authenticate, catchAsync(userCtrl.changePassword));

// ===== ADMIN ROUTES =====

/**
 * @desc    Lấy danh sách tất cả người dùng
 * @route   GET /api/users
 * @access  Private (Admin/Manager)
 */
router.get('/', authenticate, canManage, catchAsync(userCtrl.getUsers));

/**
 * @desc    Lấy người dùng theo ID
 * @route   GET /api/users/:id
 * @access  Private (Admin/Manager)
 */
router.get('/:id', authenticate, canManage, catchAsync(userCtrl.getUserById));

/**
 * @desc    Cập nhật người dùng
 * @route   PUT /api/users/:id
 * @access  Private (Admin/Manager)
 */
router.put('/:id', authenticate, canManage, catchAsync(userCtrl.updateUser));

/**
 * @desc    Xóa người dùng (soft delete)
 * @route   DELETE /api/users/:id
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, isAdmin, catchAsync(userCtrl.deleteUser));

export default router;
