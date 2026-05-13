import mongoose from "mongoose";
import Store from "../models/store.model.js";
import User from "../models/user.model.js";
import { successResponse, errorResponse } from '../utils/response.js';
import { paginate } from '../utils/pagination.util.js';
import logger from '../utils/logger.util.js';

// ===== VALIDATION HELPERS =====

const validateObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const validateStoreData = (data, isUpdate = false) => {
  const errors = [];

  if (!isUpdate || data.storeName !== undefined) {
    if (!data.storeName?.trim()) {
      errors.push('Tên cửa hàng là bắt buộc');
    } else if (data.storeName.trim().length > 200) {
      errors.push('Tên cửa hàng không được vượt quá 200 ký tự');
    }
  }

  if (data.description !== undefined && data.description?.length > 500) {
    errors.push('Mô tả không được vượt quá 500 ký tự');
  }

  if (data.phoneNumber !== undefined) {
    const phoneRegex = /^[0-9]{10,11}$/;
    if (data.phoneNumber && !phoneRegex.test(data.phoneNumber)) {
      errors.push('Số điện thoại không hợp lệ');
    }
  }

  return errors;
};

// ===== CRUD OPERATIONS =====

/**
 * Create a new store
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const createStore = async (req, res) => {
  try {
    const { storeName, description, phoneNumber, address, bankAccount, bankName, bankBranch, managerId } = req.body;

    // Validation
    const validationErrors = validateStoreData(req.body);
    if (validationErrors.length > 0) {
      return errorResponse(res, validationErrors.join(', '), 400);
    }

    // Check if store already exists (only one store should exist)
    const existingStore = await Store.findOne();
    if (existingStore) {
      return errorResponse(res, 'Đã tồn tại cửa hàng. Chỉ được phép tạo một cửa hàng.', 400);
    }

    // Validate manager if provided
    if (managerId) {
      if (!validateObjectId(managerId)) {
        return errorResponse(res, 'ID quản lý không hợp lệ', 400);
      }

      const manager = await User.findById(managerId);
      if (!manager) {
        return errorResponse(res, 'Quản lý không tồn tại', 404);
      }

      if (!manager.isActive) {
        return errorResponse(res, 'Quản lý không hoạt động', 400);
      }
    }

    // Create new store
    const store = new Store({
      storeName: storeName.trim(),
      description: description?.trim() || '',
      phoneNumber: phoneNumber?.trim() || '',
      address: address?.trim() || '',
      bankAccount: bankAccount?.trim() || '',
      bankName: bankName?.trim() || '',
      bankBranch: bankBranch?.trim() || '',
      managerId: managerId || null
    });

    const savedStore = await store.save();

    logger.info('Cửa hàng đã được tạo thành công', {
      storeId: savedStore._id,
      storeName: savedStore.storeName,
      action: 'CREATE_STORE'
    });

    return successResponse(res, 'Tạo cửa hàng thành công', savedStore, 201);

  } catch (error) {
    logger.error('Lỗi khi tạo cửa hàng', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    if (error.code === 11000) {
      return errorResponse(res, 'Cửa hàng đã tồn tại', 409);
    }

    return errorResponse(res, 'Không thể tạo cửa hàng', 500);
  }
};

/**
 * Get all stores (with pagination)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getStores = async (req, res) => {
  try {
    const result = await paginate(req, Store, {
      defaultPage: 1,
      defaultLimit: 10,
      maxPage: 100,
      maxLimit: 50,
      allowedSortFields: ['storeName', 'createdAt', 'updatedAt'],
      defaultSortField: 'createdAt',
      defaultSortOrder: 'desc',
      searchFields: ['storeName', 'description', 'address'],
      searchMaxLength: 100,
      booleanFilters: {
        isActive: true
      },
      populate: [
        {
          path: 'managerId',
          select: 'fullName email phone role isActive'
        }
      ],
      lean: true,
      baseQuery: {}
    });

    logger.info('Danh sách cửa hàng đã được lấy thành công', {
      totalStores: result.pagination.totalItems,
      page: result.pagination.currentPage
    });

    return successResponse(res, 'Lấy danh sách cửa hàng thành công', {
      stores: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    logger.error('Lỗi khi lấy danh sách cửa hàng', {
      error: error.message,
      stack: error.stack
    });
    return errorResponse(res, 'Không thể lấy danh sách cửa hàng', 500);
  }
};

/**
 * Get store by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getStoreById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return errorResponse(res, 'ID cửa hàng không hợp lệ', 400);
    }

    const store = await Store.findById(id)
      .populate('managerId', 'fullName email phone role isActive');

    if (!store) {
      return errorResponse(res, 'Không tìm thấy cửa hàng', 404);
    }

    logger.info('Cửa hàng đã được lấy theo ID', {
      storeId: store._id,
      storeName: store.storeName
    });

    return successResponse(res, 'Lấy cửa hàng thành công', store);

  } catch (error) {
    logger.error('Lỗi khi lấy cửa hàng theo ID', {
      error: error.message,
      stack: error.stack,
      storeId: req.params.id
    });
    return errorResponse(res, 'Không thể lấy cửa hàng', 500);
  }
};

/**
 * Get active store
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getActiveStore = async (req, res) => {
  try {
    const store = await Store.findOne({ isActive: true })
      .populate('managerId', 'fullName email phone role isActive');

    if (!store) {
      return errorResponse(res, 'Không tìm thấy cửa hàng đang hoạt động', 404);
    }

    logger.info('Cửa hàng đang hoạt động đã được lấy', {
      storeId: store._id,
      storeName: store.storeName
    });

    return successResponse(res, 'Lấy cửa hàng thành công', store);

  } catch (error) {
    logger.error('Lỗi khi lấy cửa hàng đang hoạt động', {
      error: error.message,
      stack: error.stack
    });
    return errorResponse(res, 'Không thể lấy cửa hàng', 500);
  }
};

/**
 * Update store by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!validateObjectId(id)) {
      return errorResponse(res, 'ID cửa hàng không hợp lệ', 400);
    }

    // Validation
    const validationErrors = validateStoreData(updateData, true);
    if (validationErrors.length > 0) {
      return errorResponse(res, validationErrors.join(', '), 400);
    }

    const existingStore = await Store.findById(id);
    if (!existingStore) {
      return errorResponse(res, 'Không tìm thấy cửa hàng', 404);
    }

    // Validate manager if being updated
    if (updateData.managerId !== undefined) {
      if (updateData.managerId) {
        if (!validateObjectId(updateData.managerId)) {
          return errorResponse(res, 'ID quản lý không hợp lệ', 400);
        }

        const manager = await User.findById(updateData.managerId);
        if (!manager) {
          return errorResponse(res, 'Quản lý không tồn tại', 404);
        }

        if (!manager.isActive) {
          return errorResponse(res, 'Quản lý không hoạt động', 400);
        }
      } else {
        updateData.managerId = null;
      }
    }

    // Prepare update data
    const finalUpdateData = {};
    if (updateData.storeName !== undefined) {
      finalUpdateData.storeName = updateData.storeName.trim();
    }
    if (updateData.description !== undefined) {
      finalUpdateData.description = updateData.description?.trim() || '';
    }
    if (updateData.phoneNumber !== undefined) {
      finalUpdateData.phoneNumber = updateData.phoneNumber?.trim() || '';
    }
    if (updateData.address !== undefined) {
      finalUpdateData.address = updateData.address?.trim() || '';
    }
    if (updateData.bankAccount !== undefined) {
      finalUpdateData.bankAccount = updateData.bankAccount?.trim() || '';
    }
    if (updateData.bankName !== undefined) {
      finalUpdateData.bankName = updateData.bankName?.trim() || '';
    }
    if (updateData.bankBranch !== undefined) {
      finalUpdateData.bankBranch = updateData.bankBranch?.trim() || '';
    }
    if (updateData.managerId !== undefined) {
      finalUpdateData.managerId = updateData.managerId;
    }
    if (updateData.isActive !== undefined) {
      finalUpdateData.isActive = Boolean(updateData.isActive);
    }

    const updatedStore = await Store.findByIdAndUpdate(
      id,
      finalUpdateData,
      {
        returnDocument: 'after',
        runValidators: true
      }
    ).populate('managerId', 'fullName email phone role isActive');

    logger.info('Cửa hàng đã được cập nhật thành công', {
      storeId: updatedStore._id,
      storeName: updatedStore.storeName,
      changes: Object.keys(finalUpdateData),
      action: 'UPDATE_STORE'
    });

    return successResponse(res, 'Cập nhật cửa hàng thành công', updatedStore);

  } catch (error) {
    logger.error('Lỗi khi cập nhật cửa hàng', {
      error: error.message,
      stack: error.stack,
      storeId: req.params.id,
      body: req.body
    });

    if (error.code === 11000) {
      return errorResponse(res, 'Dữ liệu trùng lặp', 409);
    }

    return errorResponse(res, 'Không thể cập nhật cửa hàng', 500);
  }
};

/**
 * Delete store by ID (soft delete)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deleteStore = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return errorResponse(res, 'ID cửa hàng không hợp lệ', 400);
    }

    const store = await Store.findById(id);
    if (!store) {
      return errorResponse(res, 'Không tìm thấy cửa hàng', 404);
    }

    // Soft delete by setting isActive = false
    const deletedStore = await Store.findByIdAndUpdate(
      id,
      { isActive: false },
      { returnDocument: 'after' }
    );

    logger.info('Cửa hàng đã bị vô hiệu hóa', {
      storeId: deletedStore._id,
      storeName: deletedStore.storeName,
      action: 'DELETE_STORE'
    });

    return successResponse(res, 'Vô hiệu hóa cửa hàng thành công', {
      id: deletedStore._id,
      storeName: deletedStore.storeName,
      deleted: true
    });

  } catch (error) {
    logger.error('Lỗi khi vô hiệu hóa cửa hàng', {
      error: error.message,
      stack: error.stack,
      storeId: req.params.id
    });
    return errorResponse(res, 'Không thể vô hiệu hóa cửa hàng', 500);
  }
};

/**
 * Restore soft deleted store
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const restoreStore = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return errorResponse(res, 'ID cửa hàng không hợp lệ', 400);
    }

    const store = await Store.findById(id);
    if (!store) {
      return errorResponse(res, 'Không tìm thấy cửa hàng', 404);
    }

    if (store.isActive) {
      return errorResponse(res, 'Cửa hàng đang hoạt động', 400);
    }

    const restoredStore = await Store.findByIdAndUpdate(
      id,
      { isActive: true },
      { returnDocument: 'after' }
    ).populate('managerId', 'fullName email phone role isActive');

    logger.info('Cửa hàng đã được khôi phục thành công', {
      storeId: restoredStore._id,
      storeName: restoredStore.storeName,
      action: 'RESTORE_STORE'
    });

    return successResponse(res, 'Khôi phục cửa hàng thành công', restoredStore);

  } catch (error) {
    logger.error('Lỗi khi khôi phục cửa hàng', {
      error: error.message,
      stack: error.stack,
      storeId: req.params.id
    });
    return errorResponse(res, 'Không thể khôi phục cửa hàng', 500);
  }
};
