import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { successResponse, errorResponse } from '../utils/response.js';
import { generateTokens } from '../middlewares/auth.middleware.js';
import logger from '../utils/logger.util.js';

// ===== VALIDATION HELPERS =====

const validateObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const validateUserData = (data, isUpdate = false) => {
  const errors = [];

  if (!isUpdate || data.username !== undefined) {
    if (!data.username?.trim()) {
      errors.push('Tên đăng nhập là bắt buộc');
    } else if (data.username.length < 3) {
      errors.push('Tên đăng nhập phải có ít nhất 3 ký tự');
    } else if (data.username.length > 50) {
      errors.push('Tên đăng nhập không được vượt quá 50 ký tự');
    }
  }

  if (!isUpdate || data.email !== undefined) {
    if (!data.email?.trim()) {
      errors.push('Email là bắt buộc');
    } else if (!/^\S+@\S+\.\S+$/.test(data.email)) {
      errors.push('Email không hợp lệ');
    }
  }

  if (!isUpdate || data.fullName !== undefined) {
    if (!data.fullName?.trim()) {
      errors.push('Họ tên là bắt buộc');
    } else if (data.fullName.length > 100) {
      errors.push('Họ tên không được vượt quá 100 ký tự');
    }
  }

  if (data.phone !== undefined) {
    if (data.phone && !/^[0-9]{10,11}$/.test(data.phone)) {
      errors.push('Số điện thoại không hợp lệ');
    }
  }

  return errors;
};

// ===== AUTHENTICATION OPERATIONS =====

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const register = async (req, res) => {
  try {
    const { username, email, password, fullName, phone, role, address } = req.body;

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

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      fullName: fullName.trim(),
      phone: phone?.trim() || '',
      address: address?.trim() || '',
      role: role || 'staff',
      isActive: true
    });

    const savedUser = await user.save();

    // Generate tokens
    const tokens = generateTokens(savedUser);

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
        username: savedUser.username,
        email: savedUser.email,
        fullName: savedUser.fullName,
        role: savedUser.role,
        isActive: savedUser.isActive
      },
      tokens
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
    const { username, password } = req.body;

    // Validation
    if (!username?.trim()) {
      return errorResponse(res, 'Tên đăng nhập là bắt buộc', 400);
    }

    if (!password) {
      return errorResponse(res, 'Mật khẩu là bắt buộc', 400);
    }

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: username.trim().toLowerCase() }
      ]
    }).select('+password');

    if (!user) {
      logger.warn('Đăng nhập thất bại: Người dùng không tồn tại', {
        username: username.trim(),
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
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt
      },
      tokens
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
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return errorResponse(res, 'Không tìm thấy người dùng', 404);
    }

    return successResponse(res, 'Lấy thông tin người dùng thành công', user);

  } catch (error) {
    logger.error('Lỗi khi lấy thông tin người dùng', {
      error: error.message,
      stack: error.stack,
      userId: req.userId
    });
    return errorResponse(res, 'Không thể lấy thông tin người dùng', 500);
  }
};

/**
 * Update user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateProfile = async (req, res) => {
  try {
    const { fullName, phone, address, avatar } = req.body;

    // Validation
    const validationErrors = validateUserData(req.body, true);
    if (validationErrors.length > 0) {
      return errorResponse(res, validationErrors.join(', '), 400);
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return errorResponse(res, 'Không tìm thấy người dùng', 404);
    }

    // Prepare update data
    const updateData = {};
    if (fullName !== undefined) {
      updateData.fullName = fullName.trim();
    }
    if (phone !== undefined) {
      updateData.phone = phone?.trim() || '';
    }
    if (address !== undefined) {
      updateData.address = address?.trim() || '';
    }
    if (avatar !== undefined) {
      updateData.avatar = avatar?.trim() || '';
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    logger.info('Người dùng đã cập nhật hồ sơ thành công', {
      userId: updatedUser._id,
      changes: Object.keys(updateData),
      action: 'UPDATE_PROFILE'
    });

    return successResponse(res, 'Cập nhật hồ sơ thành công', updatedUser);

  } catch (error) {
    logger.error('Lỗi khi cập nhật hồ sơ người dùng', {
      error: error.message,
      stack: error.stack,
      userId: req.userId
    });
    return errorResponse(res, 'Không thể cập nhật hồ sơ', 500);
  }
};

/**
 * Change password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword) {
      return errorResponse(res, 'Mật khẩu hiện tại là bắt buộc', 400);
    }

    if (!newPassword || newPassword.length < 6) {
      return errorResponse(res, 'Mật khẩu mới phải có ít nhất 6 ký tự', 400);
    }

    const user = await User.findById(req.userId).select('+password');
    if (!user) {
      return errorResponse(res, 'Không tìm thấy người dùng', 404);
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      logger.warn('Thay đổi mật khẩu thất bại: Mật khẩu hiện tại không đúng', {
        userId: user._id,
        ip: req.ip
      });
      return errorResponse(res, 'Mật khẩu hiện tại không đúng', 400);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    logger.info('Người dùng đã thay đổi mật khẩu thành công', {
      userId: user._id,
      action: 'CHANGE_PASSWORD'
    });

    return successResponse(res, 'Thay đổi mật khẩu thành công', null);

  } catch (error) {
    logger.error('Lỗi khi thay đổi mật khẩu', {
      error: error.message,
      stack: error.stack,
      userId: req.userId
    });
    return errorResponse(res, 'Không thể thay đổi mật khẩu', 500);
  }
};

// ===== ADMIN OPERATIONS =====

/**
 * Get all users (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, isActive, search } = req.query;

    const query = {};

    if (role) {
      query.role = role;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    logger.info('Danh sách người dùng đã được lấy thành công', {
      totalUsers: total,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    return successResponse(res, 'Lấy danh sách người dùng thành công', {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    logger.error('Lỗi khi lấy danh sách người dùng', {
      error: error.message,
      stack: error.stack
    });
    return errorResponse(res, 'Không thể lấy danh sách người dùng', 500);
  }
};

/**
 * Get user by ID (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return errorResponse(res, 'ID người dùng không hợp lệ', 400);
    }

    const user = await User.findById(id).select('-password');

    if (!user) {
      return errorResponse(res, 'Không tìm thấy người dùng', 404);
    }

    return successResponse(res, 'Lấy người dùng thành công', user);

  } catch (error) {
    logger.error('Lỗi khi lấy người dùng theo ID', {
      error: error.message,
      stack: error.stack,
      userId: req.params.id
    });
    return errorResponse(res, 'Không thể lấy người dùng', 500);
  }
};

/**
 * Update user (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, address, role, isActive, permissions } = req.body;

    if (!validateObjectId(id)) {
      return errorResponse(res, 'ID người dùng không hợp lệ', 400);
    }

    const user = await User.findById(id);
    if (!user) {
      return errorResponse(res, 'Không tìm thấy người dùng', 404);
    }

    // Prepare update data
    const updateData = {};
    if (fullName !== undefined) {
      updateData.fullName = fullName.trim();
    }
    if (phone !== undefined) {
      updateData.phone = phone?.trim() || '';
    }
    if (address !== undefined) {
      updateData.address = address?.trim() || '';
    }
    if (role !== undefined) {
      updateData.role = role;
    }
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }
    if (permissions !== undefined) {
      updateData.permissions = permissions;
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    logger.info('Người dùng đã được cập nhật thành công', {
      userId: updatedUser._id,
      changes: Object.keys(updateData),
      action: 'UPDATE_USER'
    });

    return successResponse(res, 'Cập nhật người dùng thành công', updatedUser);

  } catch (error) {
    logger.error('Lỗi khi cập nhật người dùng', {
      error: error.message,
      stack: error.stack,
      userId: req.params.id
    });
    return errorResponse(res, 'Không thể cập nhật người dùng', 500);
  }
};

/**
 * Delete user (soft delete - admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return errorResponse(res, 'ID người dùng không hợp lệ', 400);
    }

    const user = await User.findById(id);
    if (!user) {
      return errorResponse(res, 'Không tìm thấy người dùng', 404);
    }

    // Prevent deleting yourself
    if (id === req.userId) {
      return errorResponse(res, 'Không thể xóa chính mình', 400);
    }

    // Soft delete
    user.isActive = false;
    await user.save();

    logger.info('Người dùng đã bị vô hiệu hóa', {
      userId: user._id,
      username: user.username,
      action: 'DELETE_USER'
    });

    return successResponse(res, 'Vô hiệu hóa người dùng thành công', {
      id: user._id,
      username: user.username,
      deleted: true
    });

  } catch (error) {
    logger.error('Lỗi khi vô hiệu hóa người dùng', {
      error: error.message,
      stack: error.stack,
      userId: req.params.id
    });
    return errorResponse(res, 'Không thể vô hiệu hóa người dùng', 500);
  }
};
