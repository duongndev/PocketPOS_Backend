import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import {
  successResponse,
  createdResponse,
  badRequestResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
  internalServerErrorResponse,
} from "../utils/response.js";
import { paginate } from "../utils/pagination.util.js";
import logger from "../utils/logger.util.js";
import { generateSKU } from "../utils/utility.function.js";

const sanitizeText = (value) => {
  if (typeof value !== "string") return value;
  return value.trim();
};

const parseNumberValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const buildProductPayload = (body) => ({
  categoryId: sanitizeText(body.categoryId),
  name: sanitizeText(body.name),
  barcode: sanitizeText(body.barcode),
  brand: sanitizeText(body.brand) || "",
  imageUrl: sanitizeText(body.imageUrl) || "",
  costPrice: parseNumberValue(body.costPrice),
  sellingPrice: parseNumberValue(body.sellingPrice),
  stock: parseNumberValue(body.stock),
  unit: sanitizeText(body.unit) || "Cái",
  description: sanitizeText(body.description) || "",
});

const createUniqueSKU = async (name, storeId) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const sku = generateSKU(name);
    const exists = await Product.exists({ storeId, sku });
    if (!exists) return sku;
  }
  throw new Error("Không thể tạo mã SKU duy nhất");
};

const logAction = (message, action, req, extra = {}) => {
  logger.info(message, {
    userId: req.user?._id,
    email: req.user?.email,
    role: req.user?.role,
    storeId: req.user?.storeId,
    ip: req.ip,
    action,
    ...extra,
  });
};

const logError = (message, action, req, error) => {
  logger.error(message, {
    userId: req.user?._id,
    email: req.user?.email,
    role: req.user?.role,
    storeId: req.user?.storeId,
    ip: req.ip,
    action,
    error: error?.message || error,
  });
};

export const createProduct = async (req, res) => {
  try {
    const payload = buildProductPayload(req.body);
    const { categoryId, name, barcode, costPrice, sellingPrice, stock, unit } =
      payload;

    if (
      !categoryId ||
      !name ||
      !barcode ||
      costPrice === undefined ||
      sellingPrice === undefined ||
      stock === undefined ||
      !unit
    ) {
      return badRequestResponse(res, "Vui lòng điền đầy đủ thông tin sản phẩm");
    }

    if (
      Number.isNaN(costPrice) ||
      Number.isNaN(sellingPrice) ||
      Number.isNaN(stock)
    ) {
      return badRequestResponse(res, "Các giá trị số không hợp lệ");
    }

    if (costPrice > sellingPrice) {
      return badRequestResponse(res, "Giá vốn không được lớn hơn giá bán");
    }

    if (stock < 0) {
      return badRequestResponse(res, "Tồn kho không hợp lệ");
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return notFoundResponse(res, "Danh mục không tồn tại");
    }

    const productNameExists = await Product.exists({
      storeId: req.user.storeId,
      categoryId,
      name,
      isActive: true,
    });

    if (productNameExists) {
      return conflictResponse(res, "Sản phẩm đã tồn tại trong danh mục này");
    }

    const barcodeExists = await Product.exists({
      storeId: req.user.storeId,
      barcode,
      isActive: true,
    });

    if (barcodeExists) {
      return conflictResponse(res, "Mã vạch đã tồn tại, vui lòng thử lại");
    }

    const sku = await createUniqueSKU(name, req.user.storeId);

    const product = await Product.create({
      storeId: req.user.storeId,
      categoryId,
      name,
      sku,
      barcode,
      brand: payload.brand,
      imageUrl: payload.imageUrl,
      costPrice,
      sellingPrice,
      stock,
      unit,
      description: payload.description,
    });

    logAction("Tạo sản phẩm mới", "CREATE_PRODUCT", req, { data: product });

    return createdResponse(res, "Sản phẩm đã được tạo thành công", product);
  } catch (error) {
    logError("Tạo sản phẩm thất bại", "CREATE_PRODUCT_ERROR", req, error);
    return internalServerErrorResponse(res, "Tạo sản phẩm thất bại");
  }
};

export const getProducts = async (req, res) => {
  try {
    const result = await paginate(req, Product, {
      defaultPage: 1,
      defaultLimit: 10,
      maxPage: 1000,
      maxLimit: 100,
      allowedSortFields: [
        "name",
        "sku",
        "barcode",
        "brand",
        "costPrice",
        "sellingPrice",
        "stock",
        "createdAt",
        "updatedAt",
      ],
      defaultSortField: "createdAt",
      defaultSortOrder: "desc",
      searchFields: ["name", "sku", "barcode", "brand"],
      searchMaxLength: 100,
      exactFilters: {
        categoryId: true,
      },
      booleanFilters: {
        isActive: true,
      },
      baseQuery: {
        storeId: req.user.storeId,
      },
      populate: {
        path: "categoryId",
        select: "name",
      },
    });

    logAction("Lấy danh sách sản phẩm", "GET_PRODUCTS", req);

    return successResponse(
      res,
      "Lấy danh sách sản phẩm thành công",
      result.data,
      result.pagination,
    );
  } catch (error) {
    logError(
      "Lấy danh sách sản phẩm thất bại",
      "GET_PRODUCTS_ERROR",
      req,
      error,
    );
    return internalServerErrorResponse(res, "Lấy danh sách sản phẩm thất bại");
  }
};

export const getProductByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;

    const product = await Product.findOne({
      barcode,
      storeId: req.user.storeId,
      isActive: true,
    }).populate("categoryId", "name");

    if (!product) {
      return notFoundResponse(res, "Không tìm thấy sản phẩm");
    }

    logAction(
      "Lấy thông tin sản phẩm theo mã vạch",
      "GET_PRODUCT_BY_BARCODE",
      req,
      {
        details: { barcode, productId: product._id },
      },
    );

    return successResponse(
      res,
      "Thông tin sản phẩm đã được lấy thành công",
      product,
    );
  } catch (error) {
    logError(
      "Lỗi khi lấy thông tin sản phẩm theo mã vạch",
      "GET_PRODUCT_BY_BARCODE_ERROR",
      req,
      error,
    );
    return internalServerErrorResponse(
      res,
      "Lỗi khi lấy thông tin sản phẩm theo mã vạch",
    );
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      _id: id,
      storeId: req.user.storeId,
      isActive: true,
    }).populate("categoryId", "name");

    if (!product) {
      return notFoundResponse(res, "Không tìm thấy sản phẩm");
    }

    logAction("Lấy thông tin sản phẩm theo ID", "GET_PRODUCT_BY_ID", req, {
      details: { productId: id },
    });

    return successResponse(
      res,
      "Thông tin sản phẩm đã được lấy thành công",
      product,
    );
  } catch (error) {
    logError(
      "Lỗi khi lấy thông tin sản phẩm theo ID",
      "GET_PRODUCT_BY_ID_ERROR",
      req,
      error,
    );
    return internalServerErrorResponse(
      res,
      "Lỗi khi lấy thông tin sản phẩm theo ID",
    );
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = buildProductPayload(req.body);
    const { categoryId, name, barcode, costPrice, sellingPrice, stock } =
      payload;

    const product = await Product.findOne({
      _id: id,
      storeId: req.user.storeId,
      isActive: true,
    });

    if (!product) {
      return notFoundResponse(res, "Không tìm thấy sản phẩm");
    }

    if (categoryId) {
      const category = await Category.findById(categoryId);
      if (!category) {
        return notFoundResponse(res, "Danh mục không tồn tại");
      }
    }

    const proposedCategoryId = categoryId || product.categoryId;
    const proposedName = name || product.name;

    if (name && name.trim() !== product.name) {
      const nameConflict = await Product.exists({
        storeId: req.user.storeId,
        categoryId: proposedCategoryId,
        name: proposedName,
        _id: { $ne: id },
      });
      if (nameConflict) {
        return conflictResponse(res, "Sản phẩm đã tồn tại trong danh mục này");
      }
    }

    if (barcode && barcode !== product.barcode) {
      const barcodeConflict = await Product.exists({
        storeId: req.user.storeId,
        barcode,
        _id: { $ne: id },
      });
      if (barcodeConflict) {
        return conflictResponse(res, "Mã vạch đã tồn tại, vui lòng thử lại");
      }
    }

    if (
      costPrice !== undefined &&
      sellingPrice !== undefined &&
      !Number.isNaN(costPrice) &&
      !Number.isNaN(sellingPrice)
    ) {
      if (costPrice > sellingPrice) {
        return badRequestResponse(res, "Giá vốn không được lớn hơn giá bán");
      }
    }

    if (stock !== undefined && !Number.isNaN(stock) && stock < 0) {
      return badRequestResponse(res, "Số lượng tồn kho không được âm");
    }

    product.categoryId = proposedCategoryId;
    product.name = proposedName;
    product.barcode = barcode || product.barcode;
    product.brand = payload.brand || product.brand;
    product.imageUrl = payload.imageUrl || product.imageUrl;
    product.costPrice = costPrice !== undefined ? costPrice : product.costPrice;
    product.sellingPrice =
      sellingPrice !== undefined ? sellingPrice : product.sellingPrice;
    product.stock = stock !== undefined ? stock : product.stock;
    product.unit = payload.unit || product.unit;
    product.description = payload.description || product.description;

    await product.save();
    const updatedProduct = await Product.findById(id).populate(
      "categoryId",
      "name",
    );

    logAction("Cập nhật sản phẩm thành công", "UPDATE_PRODUCT", req, {
      details: { productId: id },
    });

    return successResponse(res, "Cập nhật sản phẩm thành công", updatedProduct);
  } catch (error) {
    logError("Lỗi khi cập nhật sản phẩm", "UPDATE_PRODUCT_ERROR", req, error);
    return internalServerErrorResponse(res, "Lỗi khi cập nhật sản phẩm");
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      _id: id,
      storeId: req.user.storeId,
      isActive: true,
    });

    if (!product) {
      return notFoundResponse(res, "Không tìm thấy sản phẩm");
    }

    product.isActive = false;
    await product.save();

    logAction("Xóa sản phẩm thành công", "DELETE_PRODUCT", req, {
      details: { productId: id },
    });

    return successResponse(res, "Xóa sản phẩm thành công");
  } catch (error) {
    logError("Lỗi khi xóa sản phẩm", "DELETE_PRODUCT_ERROR", req, error);
    return internalServerErrorResponse(res, "Lỗi khi xóa sản phẩm");
  }
};
