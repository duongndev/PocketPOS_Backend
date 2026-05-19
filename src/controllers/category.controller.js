import Category from '../models/category.model.js';
import Product from '../models/product.model.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { paginate, parsePaginationParams, parseSortParams, createPaginationMeta } from '../utils/pagination.util.js';
import logger from '../utils/logger.util.js';
import mongoose from 'mongoose';

// ===== VALIDATION HELPERS =====

const validateObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export { generateSlug };

const validateCategoryData = (data, isUpdate = false) => {
  const errors = [];

  if (!isUpdate || data.name !== undefined) {
    if (!data.name?.trim()) {
      errors.push('Tên danh mục là bắt buộc');
    } else if (data.name.trim().length > 100) {
      errors.push('Tên danh mục không được vượt quá 100 ký tự');
    }
  }

  if (data.description !== undefined && data.description?.length > 500) {
    errors.push('Mô tả không được vượt quá 500 ký tự');
  }

  return errors;
};

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const removeVietnameseDiacritics = (text) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, d => d === 'đ' ? 'd' : 'D');
};

const createSearchRegex = (searchTerm) => {
  if (!searchTerm) return null;

  const cleanedTerm = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const termWithoutDiacritics = removeVietnameseDiacritics(cleanedTerm);

  // Tạo regex tìm kiếm cả có dấu và không dấu
  const patterns = [
    cleanedTerm,           // Tìm kiếm có dấu
    termWithoutDiacritics  // Tìm kiếm không dấu
  ];

  return new RegExp(patterns.join('|'), 'gi');
};

const createAdvancedSearchQuery = (searchTerm) => {
  if (!searchTerm) return null;

  const cleanedTerm = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const termWithoutDiacritics = removeVietnameseDiacritics(cleanedTerm);

  // Tạo regex tìm kiếm cả có dấu và không dấu
  const searchRegex = new RegExp(cleanedTerm, 'gi');
  const searchRegexNoDiacritics = new RegExp(termWithoutDiacritics, 'gi');

  // Tạo query tìm kiếm cả có dấu và không dấu
  return {
    $or: [
      { name: searchRegex },
      { description: searchRegex },
      { nameNoDiacritics: searchRegexNoDiacritics },
      { descriptionNoDiacritics: searchRegexNoDiacritics }
    ]
  };
};

const createDiacriticFields = () => {
  return {
    $addFields: {
      nameNoDiacritics: {
        $let: {
          vars: {
            normalized: { $toLower: { $trim: { input: "$name" } } }
          },
          in: {
            $replaceAll: {
              input: {
                $replaceAll: {
                  input: "$$normalized",
                  find: /[\u0300-\u036f]/g,
                  replacement: ""
                }
              },
              find: "đ",
              replacement: "d"
            }
          }
        }
      },
      descriptionNoDiacritics: {
        $let: {
          vars: {
            normalized: { $toLower: { $trim: { input: { $ifNull: ["$description", ""] } } } }
          },
          in: {
            $replaceAll: {
              input: {
                $replaceAll: {
                  input: "$$normalized",
                  find: /[\u0300-\u036f]/g,
                  replacement: ""
                }
              },
              find: "đ",
              replacement: "d"
            }
          }
        }
      }
    }
  };
};

// ===== CRUD OPERATIONS =====

/**
 * Create a new category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const createCategory = async (req, res) => {
  try {
    const { name, description, parentId, sortOrder } = req.body;

    // Validation
    const validationErrors = validateCategoryData(req.body);
    if (validationErrors.length > 0) {
      return errorResponse(res, validationErrors.join(', '), 400);
    }

    // Generate slug
    const slug = generateSlug(name.trim());

    // Check if slug already exists
    const existingSlug = await Category.findOne({ slug });
    if (existingSlug) {
      return errorResponse(res, 'Slug đã tồn tại', 409);
    }

    // Check if category name already exists
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });

    if (existingCategory) {
      return errorResponse(res, 'Danh mục với tên này đã tồn tại', 409);
    }

    // Validate parent category if provided
    if (parentId) {
      if (!validateObjectId(parentId)) {
        return errorResponse(res, 'ID danh mục cha không hợp lệ', 400);
      }

      const parentCategory = await Category.findById(parentId);
      if (!parentCategory) {
        return errorResponse(res, 'Danh mục cha không tồn tại', 404);
      }
    }

    // Create new category
    const category = new Category({
      name: name.trim(),
      slug,
      description: description?.trim() || '',
      parentId: parentId || null,
      sortOrder: sortOrder || 0
    });

    const savedCategory = await category.save();

    logger.info('Danh mục đã được tạo thành công', {
      categoryId: savedCategory._id,
      categoryName: savedCategory.name,
      slug: savedCategory.slug,
      action: 'CREATE_CATEGORY'
    });

    return successResponse(res, 'Tạo danh mục thành công', savedCategory, 201);

  } catch (error) {
    logger.error('Lỗi khi tạo danh mục', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    if (error.code === 11000) {
      return errorResponse(res, 'Danh mục đã tồn tại', 409);
    }

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
    const query = req.sanitizedQuery || req.query;

    // Build base query
    let baseQuery = {};

    // Handle filters
    if (query.isActive !== undefined) {
      baseQuery.isActive = query.isActive === 'true';
    }

    if (query.parentId !== undefined) {
      if (query.parentId === 'null') {
        baseQuery.parentId = null;
      } else if (validateObjectId(query.parentId)) {
        baseQuery.parentId = query.parentId;
      }
    }

    // Xử lý tìm kiếm có dấu và không dấu
    if (query.search) {
      // Tạo regex tìm kiếm có dấu và không dấu
      const cleanedTerm = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const termWithoutDiacritics = removeVietnameseDiacritics(cleanedTerm);

      // Tạo query tìm kiếm cả có dấu và không dấu
      const searchQuery = {
        $or: [
          { name: { $regex: new RegExp(cleanedTerm, 'gi') } },
          { name: { $regex: new RegExp(termWithoutDiacritics, 'gi') } },
          // { description: { $regex: new RegExp(cleanedTerm, 'gi') } },
          // { description: { $regex: new RegExp(termWithoutDiacritics, 'gi') } }
        ]
      };

      // Kết hợp query cơ bản và query tìm kiếm
      const finalQuery = { ...baseQuery, ...searchQuery };

      // Sử dụng pagination utility thông thường với custom query
      const result = await paginate(req, Category, {
        defaultPage: 1,
        defaultLimit: 10,
        maxLimit: 10,
        allowedSortFields: ['name', 'slug', 'createdAt', 'updatedAt', 'sortOrder'],
        defaultSortField: 'sortOrder',
        defaultSortOrder: 'asc',
        searchFields: [], // Không dùng searchFields mặc định
        searchMaxLength: 100,
        lean: true,
        baseQuery: finalQuery,
        populate: [
          {
            path: 'parentId',
            select: 'name slug',
            match: { isActive: true }
          }
        ]
      });

      logger.info('Danh mục đã được lấy thành công', {
        totalCategories: result.pagination.totalItems,
        page: result.pagination.currentPage,
        limit: result.pagination.itemsPerPage,
        search: query.search || 'none',
        filters: {
          isActive: query.isActive || 'all',
          parentId: query.parentId || 'all'
        }
      });

      return successResponse(res, 'Lấy danh mục thành công', {
        categories: result.data,
        pagination: result.pagination
      });
    }

    // Nếu không có tìm kiếm, sử dụng pagination thông thường
    const result = await paginate(req, Category, {
      defaultPage: 1,
      defaultLimit: 10,
      maxLimit: 10,
      allowedSortFields: ['name', 'slug', 'createdAt', 'updatedAt', 'sortOrder'],
      defaultSortField: 'sortOrder',
      defaultSortOrder: 'asc',
      searchFields: [],
      searchMaxLength: 100,
      lean: true,
      baseQuery,
      populate: [
        {
          path: 'parentId',
          select: 'name slug',
          match: { isActive: true }
        }
      ]
    });

    logger.info('Danh mục đã được lấy thành công', {
      totalCategories: result.pagination.totalItems,
      page: result.pagination.currentPage,
      limit: result.pagination.itemsPerPage,
      search: query.search || 'none',
      filters: {
        isActive: query.isActive || 'all',
        parentId: query.parentId || 'all'
      }
    });

    return successResponse(res, 'Lấy danh mục thành công', {
      categories: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    logger.error('Lỗi khi lấy danh sách danh mục', {
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

    if (!validateObjectId(id)) {
      return errorResponse(res, 'ID danh mục không hợp lệ', 400);
    }

    const category = await Category.findById(id)
      .populate('parentId', 'name slug')
      .populate('children', 'name slug isActive sortOrder');

    if (!category) {
      return errorResponse(res, 'Không tìm thấy danh mục', 404);
    }

    logger.info('Danh mục đã được lấy theo ID', {
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
    const updateData = req.body;

    if (!validateObjectId(id)) {
      return errorResponse(res, 'ID danh mục không hợp lệ', 400);
    }

    // Validation
    const validationErrors = validateCategoryData(updateData, true);
    if (validationErrors.length > 0) {
      return errorResponse(res, validationErrors.join(', '), 400);
    }

    const existingCategory = await Category.findById(id);
    if (!existingCategory) {
      return errorResponse(res, 'Không tìm thấy danh mục', 404);
    }

    // Check for duplicate name (if name is being updated)
    if (updateData.name && updateData.name.trim() !== existingCategory.name) {
      const duplicateCategory = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${updateData.name.trim()}$`, 'i') }
      });

      if (duplicateCategory) {
        return errorResponse(res, 'Danh mục với tên này đã tồn tại', 409);
      }
    }

    // Validate parent category if being updated
    if (updateData.parentId !== undefined) {
      if (updateData.parentId) {
        if (!validateObjectId(updateData.parentId)) {
          return errorResponse(res, 'ID danh mục cha không hợp lệ', 400);
        }

        // Prevent circular reference
        if (updateData.parentId === id) {
          return errorResponse(res, 'Danh mục không thể là con của chính nó', 400);
        }

        const parentCategory = await Category.findById(updateData.parentId);
        if (!parentCategory) {
          return errorResponse(res, 'Danh mục cha không tồn tại', 404);
        }
      } else {
        updateData.parentId = null;
      }
    }

    // Update slug if name is changed
    if (updateData.name && updateData.name.trim() !== existingCategory.name) {
      updateData.slug = generateSlug(updateData.name.trim());

      // Check if new slug already exists
      const existingSlug = await Category.findOne({
        slug: updateData.slug,
        _id: { $ne: id }
      });

      if (existingSlug) {
        return errorResponse(res, 'Slug đã tồn tại', 409);
      }
    }

    // Prepare update data
    const finalUpdateData = {};
    if (updateData.name !== undefined) {
      finalUpdateData.name = updateData.name.trim();
    }
    if (updateData.description !== undefined) {
      finalUpdateData.description = updateData.description?.trim() || '';
    }
    if (updateData.parentId !== undefined) {
      finalUpdateData.parentId = updateData.parentId;
    }
    if (updateData.sortOrder !== undefined) {
      finalUpdateData.sortOrder = Number(updateData.sortOrder);
    }
    if (updateData.isActive !== undefined) {
      finalUpdateData.isActive = Boolean(updateData.isActive);
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      finalUpdateData,
      {
        returnDocument: 'after',
        runValidators: true,
        populate: [
          { path: 'parentId', select: 'name slug' },
          { path: 'children', select: 'name slug isActive sortOrder' }
        ]
      }
    );

    logger.info('Danh mục đã được cập nhật thành công', {
      categoryId: updatedCategory._id,
      categoryName: updatedCategory.name,
      changes: Object.keys(finalUpdateData),
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

    if (error.code === 11000) {
      return errorResponse(res, 'Danh mục đã tồn tại', 409);
    }

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

    if (!validateObjectId(id)) {
      return errorResponse(res, 'ID danh mục không hợp lệ', 400);
    }

    const category = await Category.findById(id);
    if (!category) {
      return errorResponse(res, 'Không tìm thấy danh mục', 404);
    }

    // Kiểm tra các ràng buộc trước khi xóa
    const [childrenCount, productsCount] = await Promise.all([
      // Kiểm tra danh mục con đang hoạt động
      Category.countDocuments({
        parentId: id,
        isActive: true
      }),
      // Kiểm tra sản phẩm thuộc danh mục này
      Product.countDocuments({
        categoryId: id,
        isActive: true
      })
    ]);

    // Nếu có danh mục con đang hoạt động
    if (childrenCount > 0) {
      return errorResponse(res, `Không thể xóa danh mục này vì có ${childrenCount} danh mục con đang hoạt động. Vui lòng xóa hoặc vô hiệu hóa các danh mục con trước.`, 400);
    }

    // Nếu có sản phẩm đang hoạt động
    if (productsCount > 0) {
      return errorResponse(res, `Không thể xóa danh mục này vì có ${productsCount} sản phẩm đang hoạt động. Vui lòng chuyển sản phẩm sang danh mục khác hoặc vô hiệu hóa chúng trước.`, 400);
    }

    // Soft delete bằng cách đặt isActive = false
    const deletedCategory = await Category.findByIdAndUpdate(
      id,
      { isActive: false },
      { returnDocument: 'after' }
    );

    // Cũng vô hiệu hóa tất cả sản phẩm trong danh mục này
    await Product.updateMany(
      { categoryId: id },
      { isActive: false }
    );

    logger.info('Danh mục đã được xóa (soft delete)', {
      categoryId: deletedCategory._id,
      categoryName: deletedCategory.name,
      childrenCount: childrenCount,
      productsCount: productsCount,
      action: 'DELETE_CATEGORY'
    });

    return successResponse(res, 'Xóa danh mục thành công', {
      id: deletedCategory._id,
      name: deletedCategory.name,
      deleted: true,
      affectedProducts: productsCount
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

    if (!validateObjectId(id)) {
      return errorResponse(res, 'ID danh mục không hợp lệ', 400);
    }

    const category = await Category.findById(id);
    if (!category) {
      return errorResponse(res, 'Không tìm thấy danh mục', 404);
    }

    // Kiểm tra các ràng buộc trước khi xóa vĩnh viễn
    const [childrenCount, productsCount] = await Promise.all([
      // Kiểm tra tất cả danh mục con (kể cả đã vô hiệu hóa)
      Category.countDocuments({ parentId: id }),
      // Kiểm tra tất cả sản phẩm thuộc danh mục này (kể cả đã vô hiệu hóa)
      Product.countDocuments({ categoryId: id })
    ]);

    // Nếu có danh mục con
    if (childrenCount > 0) {
      return errorResponse(res, `Không thể xóa vĩnh viễn danh mục này vì có ${childrenCount} danh mục con. Vui lòng xóa các danh mục con trước.`, 400);
    }

    // Nếu có sản phẩm
    if (productsCount > 0) {
      return errorResponse(res, `Không thể xóa vĩnh viễn danh mục này vì có ${productsCount} sản phẩm. Vui lòng xóa hoặc chuyển sản phẩm sang danh mục khác trước.`, 400);
    }

    // Xóa vĩnh viễn danh mục
    await Category.findByIdAndDelete(id);

    logger.warn('Danh mục đã bị xóa vĩnh viễn', {
      categoryId: id,
      categoryName: category.name,
      childrenCount: childrenCount,
      productsCount: productsCount,
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
 * Kiểm tra các ràng buộc của danh mục (sản phẩm và danh mục con)
 * @param {string} categoryId - ID của danh mục cần kiểm tra
 * @param {boolean} includeInactive - Có bao gồm cả mục đã vô hiệu hóa không
 * @returns {Promise<Object>} - Thông tin về các ràng buộc
 */
const checkCategoryConstraints = async (categoryId, includeInactive = false) => {
  const categoryQuery = includeInactive ? { parentId: categoryId } : {
    parentId: categoryId,
    isActive: true
  };

  const productQuery = includeInactive ? { categoryId } : {
    categoryId,
    isActive: true
  };

  const [childrenCount, productsCount, children, products] = await Promise.all([
    Category.countDocuments(categoryQuery),
    Product.countDocuments(productQuery),
    Category.find(categoryQuery).select('name slug isActive').limit(5),
    Product.find(productQuery).select('name barcode isActive').limit(5)
  ]);

  return {
    childrenCount,
    productsCount,
    children,
    products,
    canDelete: childrenCount === 0 && productsCount === 0,
    hasActiveChildren: childrenCount > 0,
    hasActiveProducts: productsCount > 0
  };
};

/**
 * Kiểm tra các ràng buộc của danh mục trước khi xóa
 */
export const checkCategoryDeleteConstraints = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeInactive = false } = req.query;

    if (!validateObjectId(id)) {
      return errorResponse(res, 'ID danh mục không hợp lệ', 400);
    }

    const category = await Category.findById(id);
    if (!category) {
      return errorResponse(res, 'Không tìm thấy danh mục', 404);
    }

    const constraints = await checkCategoryConstraints(id, includeInactive === 'true');

    logger.info('Kiểm tra ràng buộc xóa danh mục', {
      categoryId: id,
      categoryName: category.name,
      constraints: {
        childrenCount: constraints.childrenCount,
        productsCount: constraints.productsCount,
        canDelete: constraints.canDelete
      }
    });

    return successResponse(res, 'Kiểm tra ràng buộc thành công', {
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        isActive: category.isActive
      },
      constraints,
      warnings: {
        hasChildren: constraints.hasActiveChildren,
        hasProducts: constraints.hasActiveProducts,
        canSoftDelete: constraints.canDelete,
        canHardDelete: constraints.childrenCount === 0 && constraints.productsCount === 0
      }
    });

  } catch (error) {
    logger.error('Lỗi khi kiểm tra ràng buộc danh mục', {
      error: error.message,
      stack: error.stack,
      categoryId: req.params.id
    });
    return errorResponse(res, 'Không thể kiểm tra ràng buộc danh mục', 500);
  }
};

/**
 * Get category statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCategoryStats = async (req, res) => {
  try {
    const [
      totalStats,
      levelStats
    ] = await Promise.all([
      // Total, active, inactive counts
      Category.aggregate([
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
      ]),
      // Statistics by level (root vs children)
      Category.aggregate([
        {
          $group: {
            _id: {
              $cond: [{ $eq: ['$parentId', null] }, 'root', 'child']
            },
            count: { $sum: 1 },
            active: {
              $sum: { $cond: ['$isActive', 1, 0] }
            }
          }
        },
        {
          $project: {
            level: '$_id',
            count: 1,
            active: 1,
            _id: 0
          }
        }
      ])
    ]);

    const totalCategories = await Category.countDocuments();
    const activeCategories = await Category.countDocuments({ isActive: true });
    const inactiveCategories = totalCategories - activeCategories;

    const statistics = {
      total: totalCategories,
      active: activeCategories,
      inactive: inactiveCategories,
      breakdown: totalStats,
      byLevel: levelStats
    };

    logger.info('Thống kê danh mục đã được lấy thành công', statistics);

    return successResponse(res, 'Lấy thống kê danh mục thành công', statistics);

  } catch (error) {
    logger.error('Lỗi khi lấy thống kê danh mục', {
      error: error.message,
      stack: error.stack
    });
    return errorResponse(res, 'Không thể lấy thống kê danh mục', 500);
  }
};

/**
 * Get category tree structure
 */
export const getCategoryTree = async (req, res) => {
  try {
    const { includeInactive = false } = req.query;

    const matchCondition = includeInactive === 'true' ? {} : { isActive: true };

    const categories = await Category.find(matchCondition)
      .populate('parentId', 'name slug')
      .sort({ sortOrder: 1, name: 1 });

    // Build tree structure
    const buildTree = (categories, parentId = null) => {
      return categories
        .filter(cat => String(cat.parentId) === String(parentId))
        .map(cat => ({
          ...cat.toObject(),
          children: buildTree(categories, cat._id)
        }));
    };

    const tree = buildTree(categories);

    logger.info('Cây danh mục đã được lấy thành công', {
      totalCategories: categories.length,
      includeInactive: includeInactive === 'true'
    });

    return successResponse(res, 'Lấy cây danh mục thành công', tree);

  } catch (error) {
    logger.error('Lỗi khi lấy cây danh mục', {
      error: error.message,
      stack: error.stack
    });
    return errorResponse(res, 'Không thể lấy cây danh mục', 500);
  }
};

/**
 * Get all child categories (categories that have a parent)
 */
export const getChildCategories = async (req, res) => {
  try {
    const query = req.sanitizedQuery || req.query;

    // Build base query - only get categories with parentId
    let baseQuery = {
      parentId: { $ne: null, $exists: true }
    };

    // Handle isActive filter
    if (query.isActive !== undefined) {
      baseQuery.isActive = query.isActive === 'true';
    }

    // Handle search
    if (query.search) {
      const cleanedTerm = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const termWithoutDiacritics = removeVietnameseDiacritics(cleanedTerm);

      const searchQuery = {
        $or: [
          { name: { $regex: new RegExp(cleanedTerm, 'gi') } },
          { name: { $regex: new RegExp(termWithoutDiacritics, 'gi') } }
        ]
      };

      const finalQuery = { ...baseQuery, ...searchQuery };

      const result = await paginate(req, Category, {
        defaultPage: 1,
        defaultLimit: 10,
        maxLimit: 10,
        allowedSortFields: ['name', 'slug', 'createdAt', 'updatedAt', 'sortOrder'],
        defaultSortField: 'sortOrder',
        defaultSortOrder: 'asc',
        searchFields: [],
        searchMaxLength: 100,
        lean: true,
        baseQuery: finalQuery,
        populate: [
          {
            path: 'parentId',
            select: 'name slug',
            match: { isActive: true }
          }
        ]
      });

      logger.info('Danh mục con đã được lấy thành công', {
        totalCategories: result.pagination.totalItems,
        page: result.pagination.currentPage,
        limit: result.pagination.itemsPerPage,
        search: query.search || 'none'
      });

      return successResponse(res, 'Lấy danh mục con thành công', {
        categories: result.data,
        pagination: result.pagination
      });
    }

    const result = await paginate(req, Category, {
      defaultPage: 1,
      defaultLimit: 10,
      maxLimit: 10,
      allowedSortFields: ['name', 'slug', 'createdAt', 'updatedAt', 'sortOrder'],
      defaultSortField: 'sortOrder',
      defaultSortOrder: 'asc',
      searchFields: [],
      searchMaxLength: 100,
      lean: true,
      baseQuery,
      populate: [
        {
          path: 'parentId',
          select: 'name slug',
          match: { isActive: true }
        }
      ]
    });

    logger.info('Danh mục con đã được lấy thành công', {
      totalCategories: result.pagination.totalItems,
      page: result.pagination.currentPage,
      limit: result.pagination.itemsPerPage
    });

    return successResponse(res, 'Lấy danh mục con thành công', {
      categories: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    logger.error('Lỗi khi lấy danh sách danh mục con', {
      error: error.message,
      stack: error.stack,
      query: req.sanitizedQuery || req.query
    });
    return errorResponse(res, 'Không thể lấy danh mục con', 500);
  }
};

/**
 * Restore soft deleted category
 */
export const restoreCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return errorResponse(res, 'ID danh mục không hợp lệ', 400);
    }

    const category = await Category.findById(id);
    if (!category) {
      return errorResponse(res, 'Không tìm thấy danh mục', 404);
    }

    if (category.isActive) {
      return errorResponse(res, 'Danh mục đã đang hoạt động', 400);
    }

    // Check if parent is active
    if (category.parentId) {
      const parent = await Category.findById(category.parentId);
      if (!parent || !parent.isActive) {
        return errorResponse(res, 'Không thể khôi phục danh mục khi danh mục cha không hoạt động', 400);
      }
    }

    const restoredCategory = await Category.findByIdAndUpdate(
      id,
      { isActive: true },
      { returnDocument: 'after' }
    );

    logger.info('Danh mục đã được khôi phục thành công', {
      categoryId: restoredCategory._id,
      categoryName: restoredCategory.name,
      action: 'RESTORE_CATEGORY'
    });

    return successResponse(res, 'Khôi phục danh mục thành công', restoredCategory);

  } catch (error) {
    logger.error('Lỗi khi khôi phục danh mục', {
      error: error.message,
      stack: error.stack,
      categoryId: req.params.id
    });
    return errorResponse(res, 'Không thể khôi phục danh mục', 500);
  }
};
