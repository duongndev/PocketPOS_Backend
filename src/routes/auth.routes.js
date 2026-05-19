import express from "express";
const router = express.Router();
import * as authCtrl from "../controllers/auth.controller.js";
import { catchAsync } from '../middlewares/errorHandler.middleware.js';

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

export default router;
