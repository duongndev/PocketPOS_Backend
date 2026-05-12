import mongoose from "mongoose";
import Product from "../models/product.model.js";
import ProductVariant from "../models/product_variant.model.js";
import { successResponse, errorResponse } from '../utils/response.js';
import { paginate } from '../utils/pagination.util.js';
import logger from '../utils/logger.util.js';

/**
 * @desc    Tạo sản phẩm mới
 * @route   POST /api/products
 */
export const createProduct = async (req, res) => {
  try {
    const { name, categoryId, brand, description, image, variants, price, costPrice, stock, barcode } = req.body;

    // === VALIDATION ===
    const validationError = validateProductInput({ name, categoryId, variants, price, costPrice, stock, barcode });
    if (validationError) {
      return errorResponse(res, validationError);
    }

    let result;

    // === CREATE PRODUCT (WITH OR WITHOUT VARIANTS) ===
    if (variants && variants.length > 0) {
      // Check duplicate barcodes only if variants exist
      const duplicateError = await checkDuplicateBarcodes(variants);
      if (duplicateError) {
        return errorResponse(res, duplicateError);
      }

      // Create product with variants
      result = await createProductWithVariants({
        name,
        categoryId,
        brand,
        description,
        image,
        variants
      });

      logger.info(`Sản phẩm được tạo: ${result.product._id} với ${result.variants.length} variants`);
    } else {
      // Create product with auto default variant if price/barcode provided
      result = await createProductOnly({
        name,
        categoryId,
        brand,
        description,
        image,
        price,
        costPrice,
        stock,
        barcode
      });

      if (result.variants.length > 0) {
        logger.info(`Sản phẩm được tạo với default variant: ${result.product._id}`);
      } else {
        logger.info(`Sản phẩm được tạo (không có biến thể): ${result.product._id}`);
      }
    }

    return successResponse(res, "Tạo sản phẩm thành công", result);

  } catch (error) {
    logger.error(`Lỗi khi tạo sản phẩm: ${error.message}`);

    // Handle specific error types
    if (error.name === 'ValidationError') {
      return errorResponse(res, "Dữ liệu không hợp lệ", error.message);
    }

    if (error.code === 11000) {
      return errorResponse(res, "Trùng lặp dữ liệu", "Mã vạch hoặc SKU đã tồn tại");
    }

    return errorResponse(res, "Không thể tạo sản phẩm", error.message);
  }
};

/**
 * Validate product input data
 */
const validateProductInput = ({ name, categoryId, variants, price, costPrice, stock, barcode }) => {
  // Validate required fields
  if (!name?.trim()) {
    return "Tên sản phẩm là bắt buộc";
  }

  if (!categoryId) {
    return "Danh mục là bắt buộc";
  }

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return "Định dạng danh mục không hợp lệ";
  }

  // Validate variants (optional now)
  if (variants !== undefined && variants !== null) {
    if (!Array.isArray(variants)) {
      return "Biến thể phải là một mảng";
    }

    if (variants.length > 0) {
      // Validate each variant only if variants are provided
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        const variantErrors = [];

        if (!variant.barcode?.trim()) {
          variantErrors.push("mã vạch");
        }

        if (typeof variant.price !== 'number' || variant.price < 0) {
          variantErrors.push("giá hợp lệ");
        }

        if (variantErrors.length > 0) {
          return `Biến thể ${i + 1}: Thiếu ${variantErrors.join(', ')}`;
        }

        // Validate optional numeric fields
        if (variant.costPrice !== undefined && (typeof variant.costPrice !== 'number' || variant.costPrice < 0)) {
          return `Biến thể ${i + 1}: Giá vốn phải là số không âm`;
        }

        if (variant.stock !== undefined && (typeof variant.stock !== 'number' || variant.stock < 0)) {
          return `Biến thể ${i + 1}: Tồn kho phải là số không âm`;
        }
      }
    }
  }

  // Validate direct price/stock/barcode for products without variants
  if (!variants || variants.length === 0) {
    if (price !== undefined) {
      if (typeof price !== 'number' || price < 0) {
        return "Giá phải là số không âm";
      }
    }

    if (costPrice !== undefined) {
      if (typeof costPrice !== 'number' || costPrice < 0) {
        return "Giá vốn phải là số không âm";
      }
    }

    if (stock !== undefined) {
      if (typeof stock !== 'number' || stock < 0) {
        return "Số lượng phải là số không âm";
      }
    }

    if (barcode !== undefined) {
      if (!barcode?.trim()) {
        return "Mã vạch không được để trống";
      }
    }
  }

  return null;
};

/**
 * Check for duplicate barcodes in the system
 */
const checkDuplicateBarcodes = async (variants) => {
  const barcodes = variants.map(v => v.barcode.trim()).filter(Boolean);

  if (barcodes.length === 0) {
    return null;
  }

  // Check for duplicates within the request
  const duplicateInRequest = barcodes.filter((barcode, index) => barcodes.indexOf(barcode) !== index);
  if (duplicateInRequest.length > 0) {
    return `Mã vạch trùng lặp trong request: ${[...new Set(duplicateInRequest)].join(', ')}`;
  }

  // Check for duplicates in database
  const existingVariants = await ProductVariant.find({
    barcode: { $in: barcodes },
    isActive: true
  }).select('barcode').lean();

  if (existingVariants.length > 0) {
    const existingBarcodes = existingVariants.map(v => v.barcode);
    return `Mã vạch đã tồn tại: ${existingBarcodes.join(', ')}`;
  }

  return null;
};

/**
 * Create product only (without variants) - with auto default variant creation
 */
const createProductOnly = async ({ name, categoryId, brand, description, image, price, costPrice, stock, barcode }) => {
  // Create product
  const product = await Product.create({
    name: name.trim(),
    categoryId,
    brand: brand?.trim() || "",
    description: description?.trim() || "",
    image: image?.trim() || "",
    isActive: true
  });

  try {
    // Auto create default variant if sufficient data provided
    if (price && barcode) {
      const defaultVariant = await ProductVariant.create({
        productId: product._id,
        name: name.trim(),
        barcode: barcode.trim(),
        sku: null,
        price: Number(price),
        costPrice: costPrice !== undefined ? Number(costPrice) : 0,
        stock: stock !== undefined ? Number(stock) : 0,
        unit: "piece",
        conversionValue: 1,
        attributes: {},
        isActive: true
      });

      // Get populated product data
      const populatedProduct = await Product.findById(product._id)
        .populate("categoryId", "name")
        .lean();

      return {
        product: populatedProduct,
        variants: [defaultVariant]
      };
    } else {
      // Return product without variants if insufficient data
      const populatedProduct = await Product.findById(product._id)
        .populate("categoryId", "name")
        .lean();

      return {
        product: populatedProduct,
        variants: []
      };
    }
  } catch (variantError) {
    // Clean up product if variant creation fails
    logger.error(`Lỗi khi tạo default variant, đang xóa sản phẩm: ${product._id}`);
    await Product.findByIdAndDelete(product._id);
    throw variantError;
  }
};

/**
 * Create product and variants in a transaction-like manner
 */
const createProductWithVariants = async ({ name, categoryId, brand, description, image, variants }) => {
  // Create product first
  const product = await Product.create({
    name: name.trim(),
    categoryId,
    brand: brand?.trim() || "",
    description: description?.trim() || "",
    image: image?.trim() || "",
    isActive: true
  });

  try {
    // Create all variants in parallel
    const productVariants = await Promise.all(
      variants.map(variant =>
        ProductVariant.create({
          productId: product._id,
          name: variant.name?.trim() || name.trim(),
          barcode: variant.barcode.trim(),
          sku: variant.sku?.trim(),
          price: Number(variant.price),
          costPrice: variant.costPrice !== undefined ? Number(variant.costPrice) : 0,
          stock: variant.stock !== undefined ? Number(variant.stock) : 0,
          unit: variant.unit?.trim() || "piece",
          conversionValue: variant.conversionValue !== undefined ? Number(variant.conversionValue) : 1,
          attributes: variant.attributes || {},
          isActive: true
        })
      )
    );

    // Get populated product data
    const populatedProduct = await Product.findById(product._id)
      .populate("categoryId", "name")
      .lean();

    return {
      product: populatedProduct,
      variants: productVariants
    };

  } catch (variantError) {
    // If variant creation fails, clean up product
    logger.error(`Lỗi khi tạo biến thể, đang xóa sản phẩm: ${product._id}`);
    await Product.findByIdAndDelete(product._id);
    throw variantError;
  }
};


/**
 * @desc    Lấy tất cả sản phẩm (với bộ lọc, tìm kiếm, phân trang)
 * @route   GET /api/products
 */
export const getProducts = async (req, res) => {
  try {
    // Lấy danh sách sản phẩm với pagination
    const result = await paginate(req, Product, {
      defaultPage: 1,
      defaultLimit: 10,
      maxPage: 1000,
      maxLimit: 100,
      allowedSortFields: ['name', 'brand', 'createdAt', 'updatedAt'],
      defaultSortField: 'createdAt',
      defaultSortOrder: 'desc',
      searchFields: ['name', 'description'],
      searchMaxLength: 100,
      booleanFilters: {
        isActive: true
      },
      exactFilters: ['categoryId', 'brand'],
      populate: 'categoryId',
      lean: true,
      baseQuery: {}
    });

    // Lấy variants cho tất cả sản phẩm trong một query duy nhất để tối ưu performance
    const productIds = result.data.map(product => product._id);
    const variants = await ProductVariant.find({
      productId: { $in: productIds },
      isActive: true
    }).select('productId name barcode sku price costPrice stock unit attributes isActive').lean();

    // Group variants by productId
    const variantsByProduct = variants.reduce((acc, variant) => {
      if (!acc[variant.productId]) {
        acc[variant.productId] = [];
      }
      acc[variant.productId].push(variant);
      return acc;
    }, {});

    // Kết hợp sản phẩm với variants
    const productsWithVariants = result.data.map(product => ({
      ...product,
      variants: variantsByProduct[product._id] || []
    }));

    logger.info(`Lấy ${productsWithVariants.length} sản phẩm (trang ${result.pagination.currentPage})`);

    return successResponse(res, "Lấy danh sách sản phẩm thành công", {
      products: productsWithVariants,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`Lỗi khi lấy danh sách sản phẩm: ${error.message}`);
    return errorResponse(res, "Không thể lấy danh sách sản phẩm", error.message);
  }
};

/**
 * @desc    Lấy danh sách tất cả sản phẩm biến thể (với bộ lọc, phân trang)
 * @route   GET /api/products/variants/all
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
 * @route   GET /api/products/:id/variants
 */
export const getProductVariants = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Định dạng ID sản phẩm không hợp lệ", 400);
    }

    const variants = await ProductVariant.find({
      productId: id,
      isActive: true
    }).lean();

    logger.info(`Lấy danh sách biến thể của sản phẩm: ${id}`);
    return successResponse(res, "Lấy danh sách biến thể thành công", variants);
  } catch (error) {
    logger.error(`Lỗi khi lấy danh sách biến thể: ${error.message}`);
    return errorResponse(res, "Không thể lấy danh sách biến thể", 500, error.message);
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
      .populate("categoryId")
      .lean();

    if (!product) {
      return errorResponse(res, 404, "Không tìm thấy sản phẩm");
    }

    // Get variants
    const variants = await ProductVariant.find({
      productId: id,
      isActive: true
    }).lean();

    logger.info(`Lấy sản phẩm: ${id} với ${variants.length} variants`);
    return successResponse(res, "Lấy sản phẩm theo ID thành công", {
      ...product,
      variants
    });
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

    // Tìm variant theo barcode
    const variant = await ProductVariant.findOne({ barcode, isActive: true })
      .populate({
        path: 'productId',
        populate: {
          path: 'categoryId',
          select: 'name'
        }
      })
      .lean();

    if (!variant) {
      return errorResponse(res, 404, "Không tìm thấy sản phẩm với mã vạch này");
    }

    // Get all variants of this product
    const allVariants = await ProductVariant.find({
      productId: variant.productId._id,
      isActive: true
    }).lean();

    logger.info(`Lấy sản phẩm theo mã vạch: ${barcode}`);
    return successResponse(res, 200, {
      product: variant.productId,
      currentVariant: variant,
      allVariants
    }, "Lấy sản phẩm thành công");
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

    // Kiểm tra categoryId nếu được cung cấp
    if (req.body.categoryId && !mongoose.Types.ObjectId.isValid(req.body.categoryId)) {
      return errorResponse(res, 400, "Định dạng danh mục không hợp lệ");
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: new Date() },
      { returnDocument: 'after', runValidators: true }
    ).populate("categoryId", "name");

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

    // Kiểm tra xem sản phẩm có variants nào không
    const variants = await ProductVariant.find({
      productId: id,
      isActive: true
    });

    if (variants.length > 0) {
      return errorResponse(res, 400, `Không thể xóa sản phẩm có ${variants.length} biến thể đang hoạt động. Vui lòng xóa tất cả biến thể trước.`);
    }

    // Vô hiệu hóa sản phẩm
    await Product.findByIdAndUpdate(id, { isActive: false });

    logger.info(`Sản phẩm bị vô hiệu hóa: ${id}`);
    return successResponse(res, 200, null, "Vô hiệu hóa sản phẩm thành công");
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

    // Khôi phục sản phẩm và variants
    await Product.findByIdAndUpdate(id, {
      isActive: true,
      updatedAt: new Date()
    });
    await ProductVariant.updateMany(
      { productId: id },
      { isActive: true }
    );

    const restoredProduct = await Product.findById(id)
      .populate("categoryId", "name")
      .lean();

    logger.info(`Sản phẩm được khôi phục: ${id}`);
    return successResponse(res, 200, restoredProduct, "Khôi phục sản phẩm thành công");
  } catch (error) {
    logger.error(`Lỗi khi khôi phục sản phẩm: ${error.message}`);
    return errorResponse(res, 500, "Không thể khôi phục sản phẩm", error.message);
  }
};

/**
 * @desc    Thêm variant cho sản phẩm
 * @route   POST /api/products/:id/variants
 */
export const addProductVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const variantData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "Định dạng ID sản phẩm không hợp lệ");
    }

    // Kiểm tra sản phẩm tồn tại
    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, 404, "Không tìm thấy sản phẩm");
    }

    // Validate variant data
    if (!variantData.barcode || !variantData.price) {
      return errorResponse(res, 400, "Mã vạch và giá là bắt buộc");
    }

    // Kiểm tra barcode đã tồn tại chưa
    const existingVariant = await ProductVariant.findOne({
      barcode: variantData.barcode,
      isActive: true
    });

    if (existingVariant) {
      return errorResponse(res, 400, "Mã vạch đã tồn tại");
    }

    // Tạo variant mới
    const newVariant = await ProductVariant.create({
      productId: id,
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

    logger.info(`Variant được thêm cho sản phẩm ${id}: ${newVariant._id}`);
    return successResponse(res, 201, newVariant, "Thêm biến thể thành công");
  } catch (error) {
    logger.error(`Lỗi khi thêm variant: ${error.message}`);
    return errorResponse(res, 500, "Không thể thêm biến thể", error.message);
  }
};

/**
 * @desc    Cập nhật variant
 * @route   PUT /api/products/:productId/variants/:variantId
 */
export const updateProductVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
      return errorResponse(res, 400, "Định dạng ID không hợp lệ");
    }

    // Kiểm tra variant tồn tại và thuộc sản phẩm
    const variant = await ProductVariant.findOne({
      _id: variantId,
      productId: productId
    });

    if (!variant) {
      return errorResponse(res, 404, "Không tìm thấy biến thể");
    }

    // Nếu cập nhật barcode, kiểm tra trùng lặp
    if (req.body.barcode && req.body.barcode !== variant.barcode) {
      const duplicateBarcode = await ProductVariant.findOne({
        barcode: req.body.barcode,
        isActive: true,
        _id: { $ne: variantId }
      });
      if (duplicateBarcode) {
        return errorResponse(res, 400, "Mã vạch đã tồn tại");
      }
    }

    const updatedVariant = await ProductVariant.findByIdAndUpdate(
      variantId,
      { ...req.body, updatedAt: new Date() },
      { returnDocument: 'after', runValidators: true }
    );

    logger.info(`Variant được cập nhật: ${variantId}`);
    return successResponse(res, 200, updatedVariant, "Cập nhật biến thể thành công");
  } catch (error) {
    logger.error(`Lỗi khi cập nhật variant: ${error.message}`);
    return errorResponse(res, 500, "Không thể cập nhật biến thể", error.message);
  }
};

/**
 * @desc    Cập nhật tồn kho variant
 * @route   PATCH /api/products/:productId/variants/:variantId/stock
 */
export const updateVariantStock = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { stock, operation = "set" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
      return errorResponse(res, 400, "Định dạng ID không hợp lệ");
    }

    if (stock === undefined || stock === null) {
      return errorResponse(res, 400, "Giá trị tồn kho là bắt buộc");
    }

    const variant = await ProductVariant.findOne({
      _id: variantId,
      productId: productId
    });

    if (!variant) {
      return errorResponse(res, 404, "Không tìm thấy biến thể");
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
      variantId,
      { stock: newStock },
      { returnDocument: 'after' }
    );

    logger.info(`Tồn kho variant được cập nhật: ${variantId}, tồn kho mới: ${newStock}`);
    return successResponse(res, 200, updatedVariant, "Cập nhật tồn kho thành công");
  } catch (error) {
    logger.error(`Lỗi khi cập nhật tồn kho variant: ${error.message}`);
    return errorResponse(res, 500, "Không thể cập nhật tồn kho", error.message);
  }
};

/**
 * @desc    Xóa variant
 * @route   DELETE /api/products/:productId/variants/:variantId
 */
export const deleteProductVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
      return errorResponse(res, 400, "Định dạng ID không hợp lệ");
    }

    const variant = await ProductVariant.findOne({
      _id: variantId,
      productId: productId
    });

    if (!variant) {
      return errorResponse(res, 404, "Không tìm thấy biến thể");
    }

    // Soft delete variant
    await ProductVariant.findByIdAndUpdate(variantId, { isActive: false });

    logger.info(`Variant bị vô hiệu hóa: ${variantId}`);
    return successResponse(res, 200, null, "Vô hiệu hóa biến thể thành công");
  } catch (error) {
    logger.error(`Lỗi khi vô hiệu hóa variant: ${error.message}`);
    return errorResponse(res, 500, "Không thể vô hiệu hóa biến thể", error.message);
  }
};