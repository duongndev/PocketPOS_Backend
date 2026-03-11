import mongoose from "mongoose";
import Product from "../models/product.model.js";
import { successResponse, errorResponse } from '../utils/response.js';
import { paginate, createPaginatedResponse } from '../utils/pagination.util.js';
import logger from '../utils/logger.util.js';

/**
 * @desc    Tạo sản phẩm mới
 * @route   POST /api/products
 */
export const createProduct = async (req, res) => {
  try {
    const { name, barcode, categoryId, price, costPrice, stock } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!name || !barcode || !categoryId) {
      return errorResponse(res, 400, "Tên, mã vạch và danh mục là bắt buộc");
    }

    // Kiểm tra định dạng ObjectId
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return errorResponse(res, 400, "Định dạng danh mục không hợp lệ");
    }

    // Kiểm tra mã vạch đã tồn tại chưa
    const existingProduct = await Product.findOne({ barcode, isActive: true });
    if (existingProduct) {
      return errorResponse(res, 400, "Mã vạch đã tồn tại");
    }

    const product = await Product.create({
      name,
      barcode,
      categoryId,
      price: price || 0,
      costPrice: costPrice || 0,
      stock: stock || 0
    });

    logger.info(`Sản phẩm được tạo: ${product._id}`);
    return successResponse(res, 201, product, "Tạo sản phẩm thành công");
  } catch (error) {
    logger.error(`Lỗi khi tạo sản phẩm: ${error.message}`);
    return errorResponse(res, 500, "Không thể tạo sản phẩm", error.message);
  }
};


/**
 * @desc    Lấy tất cả sản phẩm (với bộ lọc, tìm kiếm, phân trang)
 * @route   GET /api/products
 */
export const getProducts = async (req, res) => {
  try {
    const result = await paginate(req, Product, {
      defaultPage: 1,
      defaultLimit: 10,
      maxPage: 1000,
      maxLimit: 100,
      allowedSortFields: ['name', 'price', 'stock', 'createdAt', 'updatedAt'],
      defaultSortField: 'createdAt',
      defaultSortOrder: 'desc',
      searchFields: ['name', 'barcode', 'description'],
      searchMaxLength: 100,
      booleanFilters: {
        isActive: true // Default to active products
      },
      rangeFilters: {
        price: {}
      },
      exactFilters: ['categoryId'],
      populate: 'categoryId',
      lean: true,
      baseQuery: {} // Start with empty base query, booleanFilters will handle isActive
    });

    // Custom processing for isActive filter
    const query = req.sanitizedQuery || req.query;
    if (query.isActive !== undefined) {
      result.query.isActive = query.isActive === 'true';
    }

    // Re-execute with custom query
    const customResult = await paginate(req, Product, {
      defaultPage: 1,
      defaultLimit: 10,
      maxPage: 1000,
      maxLimit: 100,
      allowedSortFields: ['name', 'price', 'stock', 'createdAt', 'updatedAt'],
      defaultSortField: 'createdAt',
      defaultSortOrder: 'desc',
      searchFields: ['name', 'barcode', 'description'],
      searchMaxLength: 100,
      booleanFilters: {},
      rangeFilters: {
        price: {}
      },
      exactFilters: ['categoryId'],
      populate: 'categoryId',
      lean: true,
      baseQuery: result.query
    });

    logger.info(`Lấy ${customResult.data.length} sản phẩm (trang ${customResult.pagination.currentPage})`);
    
    return successResponse(res, "Lấy sản phẩm thành công", {
      products: customResult.data,
      pagination: customResult.pagination
    });
  } catch (error) {
    logger.error(`Lỗi khi lấy sản phẩm: ${error.message}`);
    return errorResponse(res, 500, "Không thể lấy sản phẩm", error.message);
  }
};


/**
 * @desc    Lấy sản phẩm theo ID
 * @route   GET /api/products/:id
 */
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "Định dạng ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id)
      .populate("categoryId", "name slug")
      .lean();

    if (!product) {
      return errorResponse(res, 404, "Không tìm thấy sản phẩm");
    }

    logger.info(`Lấy sản phẩm: ${id}`);
    return successResponse(res, "Lấy  sản phẩm theo ID thành công", product);
  } catch (error) {
    logger.error(`Lỗi khi lấy sản phẩm theo ID: ${error.message}`);
    return errorResponse(res, 500, "Không thể lấy sản phẩm", error.message);
  }
};


/**
 * @desc    Lấy sản phẩm theo mã vạch
 * @route   GET /api/products/barcode/:barcode
 */
export const getProductByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;

    if (!barcode) {
      return errorResponse(res, 400, "Mã vạch là bắt buộc");
    }

    const product = await Product.findOne({ barcode, isActive: true })
      .populate("categoryId", "name slug")
      .lean();

    if (!product) {
      return errorResponse(res, 404, "Không tìm thấy sản phẩm với mã vạch này");
    }

    logger.info(`Lấy sản phẩm theo mã vạch: ${barcode}`);
    return successResponse(res, 200, product, "Lấy sản phẩm thành công");
  } catch (error) {
    logger.error(`Lỗi khi lấy sản phẩm theo mã vạch: ${error.message}`);
    return errorResponse(res, 500, "Không thể lấy sản phẩm", error.message);
  }
};


/**
 * @desc    Cập nhật sản phẩm
 * @route   PUT /api/products/:id
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "Định dạng ID sản phẩm không hợp lệ");
    }

    // Kiểm tra sản phẩm có tồn tại không
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return errorResponse(res, 404, "Không tìm thấy sản phẩm");
    }

    // Nếu cập nhật mã vạch, kiểm tra trùng lặp
    if (req.body.barcode && req.body.barcode !== existingProduct.barcode) {
      const duplicateBarcode = await Product.findOne({ 
        barcode: req.body.barcode, 
        isActive: true,
        _id: { $ne: id }
      });
      if (duplicateBarcode) {
        return errorResponse(res, 400, "Mã vạch đã tồn tại");
      }
    }

    // Kiểm tra categoryId nếu được cung cấp
    if (req.body.categoryId && !mongoose.Types.ObjectId.isValid(req.body.categoryId)) {
      return errorResponse(res, 400, "Định dạng danh mục không hợp lệ");
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate("categoryId", "name slug");

    logger.info(`Sản phẩm được cập nhật: ${id}`);
    return successResponse(res, 200, updatedProduct, "Cập nhật sản phẩm thành công");
  } catch (error) {
    logger.error(`Lỗi khi cập nhật sản phẩm: ${error.message}`);
    return errorResponse(res, 500, "Không thể cập nhật sản phẩm", error.message);
  }
};


/**
 * @desc    Xóa mềm sản phẩm (vô hiệu hóa)
 * @route   DELETE /api/products/:id
 */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "Định dạng ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, 404, "Không tìm thấy sản phẩm");
    }

    // Xóa mềm bằng cách đặt isActive = false
    const deactivatedProduct = await Product.findByIdAndUpdate(
      id,
      { 
        isActive: false,
        deletedAt: new Date() 
      },
      { new: true }
    );

    logger.info(`Sản phẩm bị vô hiệu hóa: ${id}`);
    return successResponse(res, 200, deactivatedProduct, "Vô hiệu hóa sản phẩm thành công");
  } catch (error) {
    logger.error(`Lỗi khi vô hiệu hóa sản phẩm: ${error.message}`);
    return errorResponse(res, 500, "Không thể vô hiệu hóa sản phẩm", error.message);
  }
};

/**
 * @desc    Xóa cứng sản phẩm (xóa vĩnh viễn)
 * @route   DELETE /api/products/:id/hard
 */
export const hardDeleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "Định dạng ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, 404, "Không tìm thấy sản phẩm");
    }

    await Product.findByIdAndDelete(id);

    logger.warn(`Sản phẩm bị xóa vĩnh viễn: ${id}`);
    return successResponse(res, 200, null, "Xóa sản phẩm vĩnh viễn");
  } catch (error) {
    logger.error(`Lỗi khi xóa vĩnh viễn sản phẩm: ${error.message}`);
    return errorResponse(res, 500, "Không thể xóa sản phẩm", error.message);
  }
};

/**
 * @desc    Khôi phục sản phẩm bị vô hiệu hóa
 * @route   POST /api/products/:id/restore
 */
export const restoreProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "Định dạng ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, 404, "Không tìm thấy sản phẩm");
    }

    if (product.isActive) {
      return errorResponse(res, 400, "Sản phẩm đã hoạt động");
    }

    const restoredProduct = await Product.findByIdAndUpdate(
      id,
      { 
        isActive: true,
        deletedAt: null,
        updatedAt: new Date()
      },
      { new: true }
    ).populate("categoryId", "name slug");

    logger.info(`Sản phẩm được khôi phục: ${id}`);
    return successResponse(res, 200, restoredProduct, "Khôi phục sản phẩm thành công");
  } catch (error) {
    logger.error(`Lỗi khi khôi phục sản phẩm: ${error.message}`);
    return errorResponse(res, 500, "Không thể khôi phục sản phẩm", error.message);
  }
};

/**
 * @desc    Cập nhật tồn kho sản phẩm
 * @route   PATCH /api/products/:id/stock
 */
export const updateProductStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, operation = "set" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "Định dạng ID sản phẩm không hợp lệ");
    }

    if (stock === undefined || stock === null) {
      return errorResponse(res, 400, "Giá trị tồn kho là bắt buộc");
    }

    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, 404, "Không tìm thấy sản phẩm");
    }

    let newStock;
    switch (operation) {
      case "add":
        newStock = product.stock + Number(stock);
        break;
      case "subtract":
        newStock = Math.max(0, product.stock - Number(stock));
        break;
      case "set":
      default:
        newStock = Number(stock);
        break;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { 
        stock: newStock,
        updatedAt: new Date()
      },
      { new: true }
    );

    logger.info(`Tồn kho sản phẩm được cập nhật: ${id}, tồn kho mới: ${newStock}`);
    return successResponse(res, 200, updatedProduct, "Cập nhật tồn kho sản phẩm thành công");
  } catch (error) {
    logger.error(`Lỗi khi cập nhật tồn kho sản phẩm: ${error.message}`);
    return errorResponse(res, 500, "Không thể cập nhật tồn kho sản phẩm", error.message);
  }
};