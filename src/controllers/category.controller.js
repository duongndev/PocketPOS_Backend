import Category from "../models/category.model.js";
import Product from "../models/product.model.js";
import { successResponse, errorResponse } from "../utils/response.js";
import {
  paginate,
  parsePaginationParams,
  parseSortParams,
  createPaginationMeta,
} from "../utils/pagination.util.js";
import logger from "../utils/logger.util.js";

export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name?.trim()) {
      return errorResponse(res, "Tên danh mục không được để trống");
    }

    const existingCategory = await Category.findOne({
      storeId: req.user.storeId,
      name: name.trim(),
      isActive: true,
    });
    if (existingCategory) {
      return errorResponse(res, "Danh mục đã tồn tại", 409);
    }

    const category = await Category.create({
      storeId: req.user.storeId,
      name: name.trim(),
      description,
    });

    logger.info("Tạo danh mục mới thành công", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "CREATE_CATEGORY",
    });

    return successResponse(
      res,
      "Danh mục đã được tạo thành công",
      category,
      201,
    );
  } catch (error) {
    logger.error("Lỗi khi tạo danh mục", {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });
    return errorResponse(res, "Lỗi khi tạo danh mục", 500, error.message);
  }
};

export const getCategories = async (req, res) => {
  try {
    const result = await paginate(req, Category, {
      defaultPage: 1,
      defaultLimit: 10,
      maxPage: 1000,
      maxLimit: 100,
      allowedSortFields: ["name", "createdAt", "updatedAt"],
      defaultSortField: "createdAt",
      defaultSortOrder: "desc",
      searchFields: [],
      booleanFilters: {
        isActive: true,
      },
      baseQuery: {
        storeId: req.user.storeId,
      },
    });

    logger.info("Lấy danh sách danh mục", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "GET_CATEGORIES",
    });

    return successResponse(
      res,
      200,
      "Danh sách danh mục đã được lấy thành công",
      result.data,
      result.pagination,
    );
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách danh mục", {
      error: error.message,
      stack: error.stack,
      query: req.query,
    });
    return errorResponse(res, "Lỗi khi lấy danh sách danh mục", 500, error.message);
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const categoryId = req.params.id;

    const category = await Category.findOne({
      _id: categoryId,
      storeId: req.user.storeId,
      isActive: true,
    });

    if (!category) {
      return errorResponse(res, "Không tìm thấy danh mục", 404);
    }

    logger.info("Lấy thông tin danh mục", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "GET_CATEGORY",
      details: {
        categoryId,
      },
    });

    return successResponse(
      res,
      "Thông tin danh mục đã được lấy thành công",
      category,
    );
  } catch (error) {
    logger.error("Lỗi khi lấy thông tin danh mục", {
      error: error.message,
      stack: error.stack,
      params: req.params,
    });
    return errorResponse(res, "Lỗi khi lấy thông tin danh mục", 500, error.message);
  }
};

export const updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { name, description } = req.body;

    const category = await Category.findOne({
      _id: categoryId,
      storeId: req.user.storeId,
      isActive: true,
    });

    if (!category) {
      return errorResponse(res, "Không tìm thấy danh mục", 404);
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      {
        name: name.trim(),
        description,
      },
      { new: true }
    );

    logger.info("Cập nhật danh mục thành công", {
      userId: req.user._id,
      email: req.user.email,
      storeId: req.user.storeId,
      role: req.user.role,
      ip: req.ip,
      action: "UPDATE_CATEGORY",
      details: {
        categoryId,
      },
    });

    return successResponse(
      res,
      "Danh mục đã được cập nhật thành công",
      updatedCategory
    );
  } catch (error) {
    logger.error("Lỗi khi cập nhật danh mục", {
      error: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
    });
    return errorResponse(res, "Lỗi khi cập nhật danh mục", 500, error.message);
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;

    const category = await Category.findOne({
      _id: categoryId,
      storeId: req.user.storeId,
      isActive: true,
    });

    if (!category) {
      return errorResponse(res, "Không tìm thấy danh mục", 404);
    }

    const hasProducts = await Product.exists({
      categoryId,
      storeId: req.user.storeId,
      isActive: true,
    });

    if (hasProducts) {
      return errorResponse(
        res,
        "Không thể xóa danh mục vì còn sản phẩm liên quan",
        400
      );
    }

    category.isActive = false;
    await category.save();

    logger.info("Xóa danh mục thành công", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "DELETE_CATEGORY",
      details: {
        categoryId,
      },
    });

    return successResponse(res, "Danh mục đã được xóa thành công");
  } catch (error) {
    logger.error("Lỗi khi xóa danh mục", {
      error: error.message,
      stack: error.stack,
      params: req.params,
    });
    return errorResponse(res, "Lỗi khi xóa danh mục", 500, error.message);
  }
};