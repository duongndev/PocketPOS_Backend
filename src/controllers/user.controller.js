import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.util.js';
import { validateUserData } from '../utils/validation.util.js';

// ===== VALIDATION HELPERS =====

const validateObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
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
