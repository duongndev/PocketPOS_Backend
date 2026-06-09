import mongoose from "mongoose";
import Store from "../models/store.model.js";
import User from "../models/user.model.js";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  badRequestResponse,
} from "../utils/response.js";
import { paginate } from "../utils/pagination.util.js";
import logger from "../utils/logger.util.js";
import { BankList } from "../utils/utility.function.js";

export const getStoreProfile = async (req, res) => {
  try {
    const store = await Store.findById(req.user.storeId);

    if (!store) {
      return notFoundResponse(res, "Không tìm thấy cửa hàng");
    }

    logger.info("Lấy thông tin cửa hàng", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "GET_STORE_PROFILE",
    });

    return successResponse(res, "Lấy thông tin cửa hàng thành công", store);
  } catch (error) {
    logger.error("Lỗi khi lấy thông tin cửa hàng", {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      ip: req.ip,
      action: "GET_STORE_PROFILE",
    });
    return errorResponse(
      res,
      "Không thể lấy thông tin cửa hàng",
      error.message,
    );
  }
};

/**
 * Validates store profile data
 * @param {Object} data - Store data to validate
 * @returns {Array} Array of validation error messages
 */
const validateStoreProfile = (data) => {
  const errors = [];

  if (data.storeName !== undefined) {
    if (!data.storeName?.trim()) {
      errors.push("Tên cửa hàng là bắt buộc");
    } else if (data.storeName.length > 200) {
      errors.push("Tên cửa hàng không được vượt quá 200 ký tự");
    }
  }

  if (data.phoneNumber !== undefined) {
    if (
      data.phoneNumber &&
      !/^[0-9]{10,11}$/.test(data.phoneNumber.replace(/[\s\-\+]/g, ""))
    ) {
      errors.push("Số điện thoại không hợp lệ (10-11 chữ số)");
    }
  }

  if (data.address !== undefined) {
    if (data.address && data.address.length > 500) {
      errors.push("Địa chỉ không được vượt quá 500 ký tự");
    }
  }

  if (data.description !== undefined) {
    if (data.description && data.description.length > 500) {
      errors.push("Mô tả không được vượt quá 500 ký tự");
    }
  }

  if (data.logoUrl !== undefined) {
    if (data.logoUrl && !isValidUrl(data.logoUrl)) {
      errors.push("URL logo không hợp lệ");
    }
  }

  return errors;
};

/**
 * Helper function to validate URL
 */
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

/**
 * Calculate if store profile is complete
 */
const isProfileComplete = (store) => {
  return !!(store.storeName && store.phoneNumber && store.address);
};

export const updateStoreProfile = async (req, res) => {
  try {
    const { storeName, phoneNumber, address, description, logoUrl } = req.body;

    // Check if at least one field is provided for update
    const hasDataToUpdate = Object.values(req.body).some(
      (value) => value !== undefined && value !== null && value !== "",
    );

    if (!hasDataToUpdate) {
      return badRequestResponse(
        res,
        "Vui lòng cung cấp ít nhất một trường để cập nhật",
      );
    }

    // Validate input data
    const validationErrors = validateStoreProfile(req.body);
    if (validationErrors.length > 0) {
      return badRequestResponse(res, validationErrors.join("; "));
    }

    // Find existing store
    const store = await Store.findById(req.user.storeId);
    if (!store) {
      return notFoundResponse(res, "Không tìm thấy cửa hàng");
    }

    // Build update object with only provided fields
    const updateData = {};
    if (storeName !== undefined) updateData.storeName = storeName.trim();
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber.trim();
    if (address !== undefined) updateData.address = address.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;

    // Update store with new data
    Object.assign(store, updateData);

    // Calculate profile completion status
    store.isCompleteProfile = isProfileComplete(store);

    // Save updated store
    await store.save();

    logger.info("Cập nhật thông tin cửa hàng", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "UPDATE_STORE_PROFILE",
      updatedFields: Object.keys(updateData),
    });

    return successResponse(
      res,
      "Cập nhật thông tin cửa hàng thành công",
      store,
    );
  } catch (error) {
    logger.error("Lỗi khi cập nhật thông tin cửa hàng", {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      ip: req.ip,
      action: "UPDATE_STORE_PROFILE",
    });
    return errorResponse(
      res,
      "Không thể cập nhật thông tin cửa hàng",
      error.message,
    );
  }
};

export const updateStoreStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const store = await Store.findByIdAndUpdate(
      req.user.storeId,
      {
        isActive,
      },
      {
        new: true,
      },
    );

    if (!store) {
      return notFoundResponse(res, "Không tìm thấy cửa hàng");
    }

    logger.info("Cập nhật trạng thái cửa hàng", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "UPDATE_STORE_STATUS",
      details: {
        isActive,
      },
    });

    return successResponse(res, "Cập nhật trạng thái thành công", store);
  } catch (error) {
    logger.error("Lỗi khi cập nhật trạng thái cửa hàng", {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      ip: req.ip,
      action: "UPDATE_STORE_STATUS",
    });
    return errorResponse(
      res,
      "Không thể cập nhật trạng thái cửa hàng",
      error.message,
    );
  }
};

export const getBanks = async (req, res) => {
  try {
    return successResponse(res, "Lấy danh sách ngân hàng", BankList);
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách ngân hàng", {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      ip: req.ip,
      action: "GET_BANKS",
    });
    return errorResponse(
      res,
      "Không thể lấy danh sách ngân hàng",
      error.message,
    );
  }
};

export const updateBankInfo = async (req, res) => {
  try {
    const { bankCode, bankName, accountNumber, accountHolderName } = req.body;

    const store = await Store.findByIdAndUpdate(
      req.user.storeId,
      {
        bankInfo: {
          bankCode,
          bankName,
          accountNumber,
          accountHolderName,
        },
      },
      {
        new: true,
      },
    );

    if (!store) {
      return notFoundResponse(res, "Không tìm thấy cửa hàng");
    }

    logger.info("Cập nhật thông tin ngân hàng", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "UPDATE_BANK_INFO",
      details: {
        bankCode,
        bankName,
        accountNumber,
        accountHolderName,
      },
    });

    return successResponse(
      res,
      "Cập nhật thông tin ngân hàng thành công",
      store,
    );
  } catch (error) {
    logger.error("Lỗi khi cập nhật thông tin ngân hàng", {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      ip: req.ip,
      action: "UPDATE_BANK_INFO",
    });
    return errorResponse(
      res,
      "Không thể cập nhật thông tin ngân hàng",
      error.message,
    );
  }
};
