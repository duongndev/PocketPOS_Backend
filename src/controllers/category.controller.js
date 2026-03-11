import Category from '../models/category.model.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { paginate } from '../utils/pagination.util.js';
import logger from '../utils/logger.util.js';

// ===== CREATE =====

/**
 * Create a new category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return errorResponse(res, 'Tên danh mục là bắt buộc', 400);
    }

    if (name.length > 100) {
      return errorResponse(res, 'Tên danh mục không được vượt quá 100 ký tự', 400);
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });

    if (existingCategory) {
      return errorResponse(res, 'Danh mục với tên này đã tồn tại', 409);
    }

    // Create new category
    const category = new Category({
      name: name.trim(),
      description: description?.trim() || ''
    });

    const savedCategory = await category.save();

    logger.info('Danh mục đã được tạo', {
      categoryId: savedCategory._id,
      categoryName: savedCategory.name,
      action: 'CREATE_CATEGORY'
    });

    return successResponse(res, 'Tạo danh mục thành công', savedCategory, 201);

  } catch (error) {
    logger.error('Lỗi khi tạo danh mục', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    return errorResponse(res, 'Không thể tạo danh mục', 500);
  }
};

// ===== READ =====

/**
 * Get all categories with pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCategories = async (req, res) => {
  try {
    const result = await paginate(req, Category, {
      defaultPage: 1,
      defaultLimit: 10,
      maxPage: 1000,
      maxLimit: 100,
      allowedSortFields: ['name', 'createdAt', 'updatedAt'],
      defaultSortField: 'createdAt',
      defaultSortOrder: 'desc',
      searchFields: ['name', 'description'],
      searchMaxLength: 100,
      booleanFilters: {
        isActive: true // Default to active categories
      },
      lean: true,
      baseQuery: {} // Start with empty base query
    });

    // Custom processing for isActive filter
    const query = req.sanitizedQuery || req.query;
    if (query.isActive !== undefined) {
      result.query.isActive = query.isActive === 'true';
    }

    // Re-execute with custom query
    const customResult = await paginate(req, Category, {
      defaultPage: 1,
      defaultLimit: 10,
      maxPage: 1000,
      maxLimit: 100,
      allowedSortFields: ['name', 'createdAt', 'updatedAt'],
      defaultSortField: 'createdAt',
      defaultSortOrder: 'desc',
      searchFields: ['name', 'description'],
      searchMaxLength: 100,
      booleanFilters: {},
      lean: true,
      baseQuery: result.query
    });

    logger.info('Danh mục đã được lấy', {
      totalCategories: customResult.pagination.totalItems,
      page: customResult.pagination.currentPage,
      limit: customResult.pagination.itemsPerPage,
      search: query.search || 'none',
      isActive: query.isActive || 'all'
    });

    return successResponse(res, 'Lấy danh mục thành công',  {
      categories: customResult.data,
      pagination: customResult.pagination
    });

  } catch (error) {
    logger.error('Lỗi khi lấy danh mục', {
      error: error.message,
      stack: error.stack,
      query: req.sanitizedQuery || req.query
    });
    return errorResponse(res, 'Không thể lấy danh mục', 500);
  }
};

/**
 * Get category by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || id.match(/^[0-9a-fA-F]{24}$/)) {
      return errorResponse(res, 'ID danh mục không hợp lệ', 400);
    }

    const category = await Category.findById(id);

    if (!category) {
      return errorResponse(res, 'Không tìm thấy danh mục', 404);
    }

    logger.info('Danh mục đã được lấy', {
      categoryId: category._id,
      categoryName: category.name
    });

    return successResponse(res, 'Lấy danh mục thành công', category);

  } catch (error) {
    logger.error('Lỗi khi lấy danh mục theo ID', {
      error: error.message,
      stack: error.stack,
      categoryId: req.params.id
    });
    return errorResponse(res, 'Không thể lấy danh mục', 500);
  }
};

// ===== UPDATE =====

/**
 * Update category by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    // Validate ID
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return errorResponse(res, 'ID danh mục không hợp lệ', 400);
    }

    // Check if category exists
    const existingCategory = await Category.findById(id);
    if (!existingCategory) {
      return errorResponse(res, 'Không tìm thấy danh mục', 404);
    }

    // Check for duplicate name (if name is being updated)
    if (name && name.trim() !== existingCategory.name) {
      const duplicateCategory = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
      });

      if (duplicateCategory) {
        return errorResponse(res, 'Danh mục với tên này đã tồn tại', 409);
      }
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return errorResponse(res, 'Tên danh mục không được để trống', 400);
      }
      if (name.length > 100) {
        return errorResponse(res, 'Tên danh mục không được vượt quá 100 ký tự', 400);
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || '';
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    logger.info('Danh mục đã được cập nhật', {
      categoryId: updatedCategory._id,
      categoryName: updatedCategory.name,
      changes: Object.keys(updateData),
      action: 'UPDATE_CATEGORY'
    });

    return successResponse(res, 'Cập nhật danh mục thành công', updatedCategory);

  } catch (error) {
    logger.error('Lỗi khi cập nhật danh mục', {
      error: error.message,
      stack: error.stack,
      categoryId: req.params.id,
      body: req.body
    });
    return errorResponse(res, 'Không thể cập nhật danh mục', 500);
  }
};

// ===== DELETE =====

/**
 * Delete category by ID (soft delete)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return errorResponse(res, 'ID danh mục không hợp lệ', 400);
    }

    // Check if category exists
    const category = await Category.findById(id);
    if (!category) {
      return errorResponse(res, 'Không tìm thấy danh mục', 404);
    }

    // Check if category has products (optional - requires Product model)
    // const Product = mongoose.model('Product');
    // const productsCount = await Product.countDocuments({ categoryId: id, isActive: true });
    // if (productsCount > 0) {
    //   return errorResponse(res, 'Không thể xóa danh mục có sản phẩm', 400);
    // }

    // Soft delete by setting isActive to false
    const deletedCategory = await Category.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    logger.info('Danh mục đã được xóa (soft delete)', {
      categoryId: deletedCategory._id,
      categoryName: deletedCategory.name,
      action: 'DELETE_CATEGORY'
    });

    return successResponse(res, 'Xóa danh mục thành công', {
      id: deletedCategory._id,
      name: deletedCategory.name,
      deleted: true
    });

  } catch (error) {
    logger.error('Lỗi khi xóa danh mục', {
      error: error.message,
      stack: error.stack,
      categoryId: req.params.id
    });
    return errorResponse(res, 'Không thể xóa danh mục', 500);
  }
};

/**
 * Hard delete category by ID (permanent deletion)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const hardDeleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return errorResponse(res, 'ID danh mục không hợp lệ', 400);
    }

    const category = await Category.findById(id);
    if (!category) {
      return errorResponse(res, 'Không tìm thấy danh mục', 404);
    }

    await Category.findByIdAndDelete(id);

    logger.warn('Danh mục đã bị xóa vĩnh viễn', {
      categoryId: id,
      categoryName: category.name,
      action: 'HARD_DELETE_CATEGORY'
    });

    return successResponse(res, 'Xóa vĩnh viễn danh mục thành công', {
      id: category._id,
      name: category.name,
      permanentlyDeleted: true
    });

  } catch (error) {
    logger.error('Lỗi khi xóa vĩnh viễn danh mục', {
      error: error.message,
      stack: error.stack,
      categoryId: req.params.id
    });
    return errorResponse(res, 'Không thể xóa danh mục', 500);
  }
};

// ===== UTILITY =====

/**
 * Get category statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCategoryStats = async (req, res) => {
  try {
    const stats = await Category.aggregate([
      {
        $group: {
          _id: '$isActive',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          status: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    const totalCategories = await Category.countDocuments();
    const activeCategories = await Category.countDocuments({ isActive: true });
    const inactiveCategories = totalCategories - activeCategories;

    const statistics = {
      total: totalCategories,
      active: activeCategories,
      inactive: inactiveCategories,
      breakdown: stats
    };

    logger.info('Thống kê danh mục đã được lấy', statistics);

    return successResponse(res, 'Lấy thống kê danh mục thành công', statistics);

  } catch (error) {
    logger.error('Lỗi khi lấy thống kê danh mục', {
      error: error.message,
      stack: error.stack
    });
    return errorResponse(res, 'Không thể lấy thống kê danh mục', 500);
  }
};
