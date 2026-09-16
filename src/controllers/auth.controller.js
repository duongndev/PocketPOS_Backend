import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { generateTokens } from "../middlewares/auth.middleware.js";
import logger from "../utils/logger.util.js";
import { validateUserData } from "../utils/validation.util.js";
import Store from "../models/store.model.js";
import mongoose from "mongoose";

// ===== AUTHENTICATION OPERATIONS =====

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const register = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { storeName, fullName, email, password, confirmPassword, phone } =
      req.body;

    if (!storeName || !fullName || !email || !password || !confirmPassword) {
      return errorResponse(
        res,
        400,
        "Vui lòng cung cấp đầy đủ thông tin bắt buộc",
      );
    }

    const existingEmail = await User.findOne({
      email: email.trim().toLowerCase(),
    }).session(session);
    if (existingEmail) {
      return errorResponse(res, 409, "Email đã tồn tại");
    }

    if (password !== confirmPassword) {
      return errorResponse(res, "Mật khẩu và xác nhận mật khẩu không khớp");
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const store = await Store.create([{
      storeName,
    }], { session });

    const createdStore = store[0];

    const user = await User.create([{
      fullName,
      email,
      phone,
      password: hashPassword,
      storeId: createdStore._id,
    }], { session });

    const createdUser = user[0];

    createdStore.ownerId = createdUser._id;
    await createdStore.save({ session });

    await session.commitTransaction();

    logger.info("Người dùng đã đăng ký thành công", {
      userId: createdUser._id,
      email: createdUser.email,
      role: createdUser.role,
      storeId: createdStore._id,
      ip: req.ip,
      action: "REGISTER",
    });

    return successResponse(res, "Đăng ký thành công", {
      user: {
        id: createdUser._id,
        fullName: createdUser.fullName,
        email: createdUser.email,
        phone: createdUser.phone,
        role: createdUser.role,
        storeId: createdUser.storeId,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error("Lỗi khi đăng ký người dùng", {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });
    return errorResponse(res, "Lỗi khi đăng ký người dùng", error.message);
  } finally {
    await session.endSession();
  }
};

/**
 * Login user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 400, "Vui lòng cung cấp email và mật khẩu");
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() })
      .select("+password")
      .populate("storeId");

    if (!user) {
      return errorResponse(res, 401, "Email hoặc mật khẩu không đúng");
    }

    if (!user.isActive) {
      return errorResponse(res, 403, "Tài khoản của bạn đã bị khóa");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return errorResponse(res, 401, "Email hoặc mật khẩu không đúng");
    }

    const tokens = generateTokens(user);

    user.lastLoginAt = new Date();
    await user.save();

    logger.info("Người dùng đã đăng nhập thành công", {
      userId: user._id,
      email: user.email,
      storeId: user.storeId,
      ip: req.ip,
      action: "LOGIN",
    });

    return successResponse(res, "Đăng nhập thành công", {
      tokens,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        storeId: {
          _id: user.storeId?._id,
          storeName: user.storeId?.storeName,
          phoneNumber: user.storeId?.phoneNumber,
          address: user.storeId?.address,
          isCompleteProfile: user.storeId?.isCompleteProfile,
        },
      },
    });
  } catch (error) {
    logger.error("Lỗi khi đăng nhập", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });
    return errorResponse(res, "Lỗi khi đăng nhập", 500, error.message);
  }
};

/**
 * Logout user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const logout = async (req, res) => {
  try {
    logger.info("Người dùng đã đăng xuất", {
      userId: req.user._id,
      email: req.user.email,
      ip: req.ip,
      action: "LOGOUT",
    });

    return successResponse(res, "Đăng xuất thành công");
  } catch (error) {
    logger.error("Lỗi khi đăng xuất", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });
    return errorResponse(res, "Không thể đăng xuất", 500);
  }
};

/**
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId)
      .select("-password")
      .populate("storeId");

    if (!user) {
      return errorResponse(res, "Không tìm thấy người dùng", 404);
    }

    if (!user.isActive) {
      return errorResponse(res, "Tài khoản của bạn đã bị khóa", 403);
    }

    logger.info("Lấy thông tin người dùng thành công", {
      userId: userId,
      email: user.email,
      role: user.role,
      store: user.storeId,
      ip: req.ip,
      action: "GET_PROFILE",
    });

    return successResponse(res, "Lấy thông tin người dùng thành công", user);
  } catch (error) {
    logger.error("Lỗi khi lấy thông tin người dùng", {
      error: error.message,
      stack: error.stack,
      userId: userId,
    });
    return errorResponse(res, "Không thể lấy thông tin người dùng", 500);
  }
};
