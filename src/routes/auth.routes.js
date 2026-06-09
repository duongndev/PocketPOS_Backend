import express from "express";
const router = express.Router();
import * as authCtrl from "../controllers/auth.controller.js";
import { catchAsync } from '../middlewares/errorHandler.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';

// ===== PUBLIC ROUTES =====

/**
 * @desc    Đăng ký người dùng mới
 * @route   POST /api/auth/register
 * @access  Public
 */
router.post('/register', catchAsync(authCtrl.register));

/**
 * @desc    Đăng nhập
 * @route   POST /api/auth/login
 * @access  Public
 */
router.post('/login', catchAsync(authCtrl.login));

/**
 * @desc    Đăng xuất
 * @route   POST /api/auth/logout
 * @access  Public
 */
router.post('/logout', catchAsync(authCtrl.logout));

/**
 * @desc    Lấy thông tin người dùng hiện tại
 * @route   GET /api/auth/me
 * @access  Private
 */
router.get('/me', authenticate, catchAsync(authCtrl.getProfile));

export default router;
