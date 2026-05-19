import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { successResponse, errorResponse } from '../utils/response.js';
import { generateTokens } from '../middlewares/auth.middleware.js';
import logger from '../utils/logger.util.js';
import { validateUserData } from '../utils/validation.util.js';

// ===== AUTHENTICATION OPERATIONS =====

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const register = async (req, res) => {
  try {
    const { fullName, username, email, password, confirmPassword, phone} = req.body;

    // Validation
    const validationErrors = validateUserData(req.body);
    if (validationErrors.length > 0) {
      return errorResponse(res, validationErrors.join(', '), 400);
    }

    // Validate password
    if (!password || password.length < 6) {
      return errorResponse(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username: username.trim() });
    if (existingUsername) {
      return errorResponse(res, 'Tên đăng nhập đã tồn tại', 409);
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingEmail) {
      return errorResponse(res, 'Email đã tồn tại', 409);
    }

    if (password !== confirmPassword) {
      return errorResponse(res, 'Mật khẩu xác nhận không khớp', 400);
    }

    // Hash password
    const salt = await bcrypt.genSalt(15);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      fullName: fullName.trim(),
      phone: phone?.trim() || '',
      isActive: true
    });

    const savedUser = await user.save();

    logger.info('Người dùng đã đăng ký thành công', {
      userId: savedUser._id,
      username: savedUser.username,
      email: savedUser.email,
      role: savedUser.role,
      action: 'REGISTER'
    });

    return successResponse(res, 'Đăng ký thành công', {
      user: {
        id: savedUser._id,
        fullName: savedUser.fullName,
        username: savedUser.username,
        email: savedUser.email,
        role: savedUser.role,
        phone: savedUser.phone,
        isActive: savedUser.isActive
      }
    }, 201);

  } catch (error) {
    logger.error('Lỗi khi đăng ký người dùng', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    if (error.code === 11000) {
      return errorResponse(res, 'Tên đăng nhập hoặc email đã tồn tại', 409);
    }

    return errorResponse(res, 'Không thể đăng ký', 500);
  }
};

/**
 * Login user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Validation
    if (!identifier?.trim()) {
      return errorResponse(res, 'Tên đăng nhập hoặc email là bắt buộc', 400);
    }

    if (!password) {
      return errorResponse(res, 'Mật khẩu là bắt buộc', 400);
    }

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: identifier.trim() },
        { email: identifier.trim().toLowerCase() }
      ]
    }).select('+password');

    if (!user) {
      logger.warn('Đăng nhập thất bại: Người dùng không tồn tại', {
        username: identifier.trim(),
        ip: req.ip
      });
      return errorResponse(res, 'Tên đăng nhập hoặc mật khẩu không đúng', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      logger.warn('Đăng nhập thất bại: Tài khoản bị vô hiệu hóa', {
        userId: user._id,
        username: user.username,
        ip: req.ip
      });
      return errorResponse(res, 'Tài khoản đã bị vô hiệu hóa', 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.warn('Đăng nhập thất bại: Mật khẩu không đúng', {
        userId: user._id,
        username: user.username,
        ip: req.ip
      });
      return errorResponse(res, 'Tên đăng nhập hoặc mật khẩu không đúng', 401);
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate tokens
    const tokens = generateTokens(user);

    logger.info('Người dùng đã đăng nhập thành công', {
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      ip: req.ip,
      action: 'LOGIN'
    });

    return successResponse(res, 'Đăng nhập thành công', {
      tokens,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt
      },
    });

  } catch (error) {
    logger.error('Lỗi khi đăng nhập', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    return errorResponse(res, 'Không thể đăng nhập', 500);
  }
};

/**
 * Logout user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const logout = async (req, res) => {
  try {
    logger.info('Người dùng đã đăng xuất', {
      userId: req.user._id,
      username: req.user.username,
      ip: req.ip,
      action: 'LOGOUT'
    });

    return successResponse(res, 'Đăng xuất thành công');
  } catch (error) {
    logger.error('Lỗi khi đăng xuất', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    return errorResponse(res, 'Không thể đăng xuất', 500);
  }
};

/**
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return errorResponse(res, 'Không tìm thấy người dùng', 404);
    }

    return successResponse(res, 'Lấy thông tin người dùng thành công', user);

  } catch (error) {
    logger.error('Lỗi khi lấy thông tin người dùng', {
      error: error.message,
      stack: error.stack,
      userId: req.user._id
    });
    return errorResponse(res, 'Không thể lấy thông tin người dùng', 500);
  }
};