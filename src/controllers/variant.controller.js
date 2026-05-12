import mongoose from "mongoose";
import Product from "../models/product.model.js";
import ProductVariant from "../models/product_variant.model.js";
import { successResponse, errorResponse } from '../utils/response.js';
import { paginate } from '../utils/pagination.util.js';
import logger from '../utils/logger.util.js';

/**
 * @desc    Lấy danh sách tất cả sản phẩm biến thể (với bộ lọc, phân trang)
 * @route   GET /api/variants
 */
export const getAllVariants = async (req, res) => {
  try {
    const result = await paginate(req, ProductVariant, {
      defaultPage: 1,
      defaultLimit: 10,
      maxPage: 1000,
      maxLimit: 100,
      allowedSortFields: ['name', 'price', 'stock', 'createdAt', 'updatedAt'],
      defaultSortField: 'createdAt',
      defaultSortOrder: 'desc',
      searchFields: ['name', 'sku', 'barcode'],
      searchMaxLength: 100,
      booleanFilters: {
        isActive: true
      },
      exactFilters: ['productId'],
      populate: { path: 'productId', select: 'name categoryId brand image' },
      lean: true,
      baseQuery: {}
    });

    logger.info(`Lấy ${result.data.length} biến thể (trang ${result.pagination.currentPage})`);

    return successResponse(res, "Lấy danh sách biến thể thành công", {
      variants: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`Lỗi khi lấy danh sách biến thể: ${error.message}`);
    return errorResponse(res, "Không thể lấy danh sách biến thể", 500, error.message);
  }
};

/**
 * @desc    Lấy danh sách biến thể của một sản phẩm
 * @route   GET /api/variants/product/:productId
 */
export const getProductVariants = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return errorResponse(res, "Định dạng ID sản phẩm không hợp lệ", 400);
    }

    const variants = await ProductVariant.find({
      productId,
      isActive: true
    }).lean();

    logger.info(`Lấy danh sách biến thể của sản phẩm: ${productId}`);
    return successResponse(res, "Lấy danh sách biến thể thành công", variants);
  } catch (error) {
    logger.error(`Lỗi khi lấy danh sách biến thể: ${error.message}`);
    return errorResponse(res, "Không thể lấy danh sách biến thể", 500, error.message);
  }
};

/**
 * @desc    Thêm variant mới
 * @route   POST /api/variants
 */
export const addProductVariant = async (req, res) => {
  try {
    const variantData = req.body;
    const { productId } = variantData;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return errorResponse(res, "Định dạng ID sản phẩm không hợp lệ hoặc bị thiếu", 400);
    }

    // Kiểm tra sản phẩm tồn tại
    const product = await Product.findById(productId);
    if (!product) {
      return errorResponse(res, "Không tìm thấy sản phẩm", 404);
    }

    // Validate variant data
    if (!variantData.barcode || !variantData.price) {
      return errorResponse(res, "Mã vạch và giá là bắt buộc", 400);
    }

    // Kiểm tra barcode đã tồn tại chưa
    const existingVariant = await ProductVariant.findOne({
      barcode: variantData.barcode,
      isActive: true
    });

    if (existingVariant) {
      return errorResponse(res, "Mã vạch đã tồn tại", 400);
    }

    // Tạo variant mới
    const newVariant = await ProductVariant.create({
      productId: productId,
      name: variantData.name || product.name,
      barcode: variantData.barcode,
      sku: variantData.sku,
      price: variantData.price,
      costPrice: variantData.costPrice || 0,
      stock: variantData.stock || 0,
      unit: variantData.unit || "piece",
      conversionValue: variantData.conversionValue || 1,
      attributes: variantData.attributes || {},
      isActive: true
    });

    logger.info(`Variant được thêm cho sản phẩm ${productId}: ${newVariant._id}`);
    return successResponse(res, 201, newVariant, "Thêm biến thể thành công");
  } catch (error) {
    logger.error(`Lỗi khi thêm variant: ${error.message}`);
    return errorResponse(res, "Không thể thêm biến thể", 500, error.message);
  }
};

/**
 * @desc    Cập nhật variant
 * @route   PUT /api/variants/:id
 */
export const updateProductVariant = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Định dạng ID biến thể không hợp lệ", 400);
    }

    // Kiểm tra variant tồn tại
    const variant = await ProductVariant.findById(id);

    if (!variant) {
      return errorResponse(res, "Không tìm thấy biến thể", 404);
    }

    // Nếu cập nhật barcode, kiểm tra trùng lặp
    if (req.body.barcode && req.body.barcode !== variant.barcode) {
      const duplicateBarcode = await ProductVariant.findOne({
        barcode: req.body.barcode,
        isActive: true,
        _id: { $ne: id }
      });
      if (duplicateBarcode) {
        return errorResponse(res, "Mã vạch đã tồn tại", 400);
      }
    }

    const updatedVariant = await ProductVariant.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: new Date() },
      { returnDocument: 'after', runValidators: true }
    );

    logger.info(`Variant được cập nhật: ${id}`);
    return successResponse(res, 200, updatedVariant, "Cập nhật biến thể thành công");
  } catch (error) {
    logger.error(`Lỗi khi cập nhật variant: ${error.message}`);
    return errorResponse(res, "Không thể cập nhật biến thể", 500, error.message);
  }
};

/**
 * @desc    Cập nhật tồn kho variant
 * @route   PATCH /api/variants/:id/stock
 */
export const updateVariantStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, operation = "set" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Định dạng ID không hợp lệ", 400);
    }

    if (stock === undefined || stock === null) {
      return errorResponse(res, "Giá trị tồn kho là bắt buộc", 400);
    }

    const variant = await ProductVariant.findById(id);

    if (!variant) {
      return errorResponse(res, "Không tìm thấy biến thể", 404);
    }

    let newStock;
    switch (operation) {
      case "add":
        newStock = variant.stock + Number(stock);
        break;
      case "subtract":
        newStock = Math.max(0, variant.stock - Number(stock));
        break;
      case "set":
      default:
        newStock = Number(stock);
        break;
    }

    const updatedVariant = await ProductVariant.findByIdAndUpdate(
      id,
      { stock: newStock },
      { returnDocument: 'after' }
    );

    logger.info(`Tồn kho variant được cập nhật: ${id}, tồn kho mới: ${newStock}`);
    return successResponse(res, 200, updatedVariant, "Cập nhật tồn kho thành công");
  } catch (error) {
    logger.error(`Lỗi khi cập nhật tồn kho variant: ${error.message}`);
    return errorResponse(res, "Không thể cập nhật tồn kho", 500, error.message);
  }
};

/**
 * @desc    Xóa variant
 * @route   DELETE /api/variants/:id
 */
export const deleteProductVariant = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Định dạng ID biến thể không hợp lệ", 400);
    }

    const variant = await ProductVariant.findById(id);

    if (!variant) {
      return errorResponse(res, "Không tìm thấy biến thể", 404);
    }

    // Soft delete variant
    await ProductVariant.findByIdAndUpdate(id, { isActive: false });

    logger.info(`Variant bị vô hiệu hóa: ${id}`);
    return successResponse(res, 200, null, "Vô hiệu hóa biến thể thành công");
  } catch (error) {
    logger.error(`Lỗi khi vô hiệu hóa variant: ${error.message}`);
    return errorResponse(res, "Không thể vô hiệu hóa biến thể", 500, error.message);
  }
};
