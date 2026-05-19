import mongoose from "mongoose";
import Product from "../models/product.model.js";
import ProductVariant from "../models/product_variant.model.js";
import { successResponse, errorResponse } from '../utils/response.js';
import { paginate } from '../utils/pagination.util.js';
import logger from '../utils/logger.util.js';

/**
 * Generate slug from product name (Vietnamese-friendly)
 */
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Generate unique slug to avoid duplicates
 */
const generateUniqueSlug = async (name, excludeId = null) => {
  let slug = generateSlug(name);
  let counter = 1;
  let originalSlug = slug;

  while (true) {
    const query = { slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await Product.findOne(query);
    if (!existing) {
      return slug;
    }

    slug = `${originalSlug}-${counter}`;
    counter++;
  }
};

/**
 * @desc    Tạo sản phẩm mới
 * @route   POST /api/products
 */
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      categoryId,
      brand,
      description,
      images,
      variants,
      options,
      tags
    } = req.body;

    // === VALIDATION ===
    const validationError = validateProductInput({ name, categoryId, variants, options });
    if (validationError) {
      return errorResponse(res, validationError);
    }

    // === GENERATE UNIQUE SLUG ===
    const slug = await generateUniqueSlug(name);

    // === CREATE PRODUCT ===
    const productData = {
      name: name.trim(),
      slug,
      categoryId,
      brand: brand?.trim() || null,
      description: description?.trim() || "",
      images: images?.trim() || "",
      hasVariants: variants && variants.length > 0,
      options: options || [],
      tags: tags || [],
      isActive: true
    };

    const product = await Product.create(productData);

    try {
      let createdVariants = [];

      // === CREATE VARIANTS ===
      if (variants && variants.length > 0) {
        // Check for duplicate SKUs and barcodes
        const duplicateError = await checkDuplicateSKUsAndBarcodes(variants);
        if (duplicateError) {
          throw new Error(duplicateError);
        }

        createdVariants = await Promise.all(
          variants.map(variant => createVariant(product._id, variant))
        );
      } else {
        // Create default variant if no variants provided
        const { price, costPrice, quantity, barcode, sku } = req.body;

        if (!price || !sku) {
          throw new Error("Price và SKU là bắt buộc cho sản phẩm không có biến thể");
        }

        const defaultVariant = await createVariant(product._id, {
          sku,
          barcode,
          price,
          costPrice,
          quantity,
          isDefault: true
        });
        createdVariants = [defaultVariant];
      }

      // === POPULATE AND RETURN ===
      const populatedProduct = await Product.findById(product._id)
        .populate("categoryId", "name")
        .lean();

      logger.info(`Sản phẩm được tạo: ${product._id} với ${createdVariants.length} variants`);

      return successResponse(res, "Tạo sản phẩm thành công", {
        product: populatedProduct,
        variants: createdVariants
      });

    } catch (variantError) {
      // Rollback: delete product if variant creation fails
      logger.error(`Lỗi khi tạo biến thể, đang rollback sản phẩm: ${product._id}`);
      await Product.findByIdAndDelete(product._id);
      throw variantError;
    }

  } catch (error) {
    logger.error(`Lỗi khi tạo sản phẩm: ${error.message}`);

    if (error.name === 'ValidationError') {
      return errorResponse(res, "Dữ liệu không hợp lệ", error.message);
    }

    if (error.code === 11000) {
      return errorResponse(res, "Trùng lặp dữ liệu", "Slug, SKU hoặc Barcode đã tồn tại");
    }

    return errorResponse(res, "Không thể tạo sản phẩm", error.message);
  }
};

/**
 * Validate product input data
 */
const validateProductInput = ({ name, categoryId, variants, options }) => {
  // === PRODUCT VALIDATION ===
  if (!name?.trim()) {
    return "Tên sản phẩm là bắt buộc";
  }

  if (!categoryId) {
    return "Danh mục là bắt buộc";
  }

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return "Định dạng danh mục không hợp lệ";
  }

  // === OPTIONS VALIDATION ===
  if (options !== undefined && options !== null) {
    if (!Array.isArray(options)) {
      return "Options phải là một mảng";
    }
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      if (!option.name?.trim()) {
        return `Option ${i + 1}: name là bắt buộc`;
      }
      if (!Array.isArray(option.values)) {
        return `Option ${i + 1}: values phải là một mảng`;
      }
    }
  }

  // === VARIANTS VALIDATION ===
  if (variants !== undefined && variants !== null) {
    if (!Array.isArray(variants)) {
      return "Biến thể phải là một mảng";
    }

    if (variants.length > 0) {
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        const errors = validateVariantData(variant);
        if (errors) {
          return `Biến thể ${i + 1}: ${errors}`;
        }
      }
    }
  }

  return null;
};

/**
 * Validate variant data
 */
const validateVariantData = (variant) => {
  if (!variant.sku?.trim()) {
    return "SKU là bắt buộc";
  }

  if (typeof variant.price !== 'number' || variant.price < 0) {
    return "Giá phải là số không âm";
  }

  if (variant.costPrice !== undefined && (typeof variant.costPrice !== 'number' || variant.costPrice < 0)) {
    return "Giá vốn phải là số không âm";
  }

  if (variant.quantity !== undefined && (typeof variant.quantity !== 'number' || variant.quantity < 0)) {
    return "Số lượng phải là số không âm";
  }

  if (variant.reserved !== undefined && (typeof variant.reserved !== 'number' || variant.reserved < 0)) {
    return "Số lượng reserved phải là số không âm";
  }

  if (variant.conversionRate !== undefined && (typeof variant.conversionRate !== 'number' || variant.conversionRate < 1)) {
    return "Conversion rate phải >= 1";
  }

  if (variant.lowStockThreshold !== undefined && (typeof variant.lowStockThreshold !== 'number' || variant.lowStockThreshold < 0)) {
    return "Low stock threshold phải là số không âm";
  }

  // Validate attributes
  if (variant.attributes !== undefined && variant.attributes !== null) {
    if (!Array.isArray(variant.attributes)) {
      return "Attributes phải là một mảng";
    }
    for (let i = 0; i < variant.attributes.length; i++) {
      const attr = variant.attributes[i];
      if (!attr.name?.trim() || !attr.value?.trim()) {
        return `Attribute ${i + 1}: name và value là bắt buộc`;
      }
    }
  }

  return null;
};

/**
 * Check for duplicate SKUs and barcodes in the system
 */
const checkDuplicateSKUsAndBarcodes = async (variants) => {
  const skus = variants.map(v => v.sku.trim().toUpperCase()).filter(Boolean);
  const barcodes = variants.map(v => v.barcode?.trim()).filter(Boolean);

  // Check for duplicates within the request
  const duplicateSKUs = skus.filter((sku, index) => skus.indexOf(sku) !== index);
  if (duplicateSKUs.length > 0) {
    return `SKU trùng lặp trong request: ${[...new Set(duplicateSKUs)].join(', ')}`;
  }

  const duplicateBarcodes = barcodes.filter((barcode, index) => barcodes.indexOf(barcode) !== index);
  if (duplicateBarcodes.length > 0) {
    return `Mã vạch trùng lặp trong request: ${[...new Set(duplicateBarcodes)].join(', ')}`;
  }

  // Check for duplicates in database
  const existingVariants = await ProductVariant.find({
    $or: [
      { sku: { $in: skus } },
      ...(barcodes.length > 0 ? [{ barcode: { $in: barcodes } }] : [])
    ],
    isActive: true
  }).select('sku barcode').lean();

  if (existingVariants.length > 0) {
    const existingSKUs = existingVariants.filter(v => v.sku).map(v => v.sku);
    const existingBarcodes = existingVariants.filter(v => v.barcode).map(v => v.barcode);
    const errors = [];
    if (existingSKUs.length > 0) errors.push(`SKU đã tồn tại: ${existingSKUs.join(', ')}`);
    if (existingBarcodes.length > 0) errors.push(`Mã vạch đã tồn tại: ${existingBarcodes.join(', ')}`);
    return errors.join(', ');
  }

  return null;
};

/**
 * Create a single variant
 */
const createVariant = async (productId, variantData) => {
  const variant = await ProductVariant.create({
    productId,
    sku: variantData.sku.trim().toUpperCase(),
    barcode: variantData.barcode?.trim() || null,
    price: Number(variantData.price),
    costPrice: variantData.costPrice !== undefined ? Number(variantData.costPrice) : 0,
    inventory: {
      quantity: variantData.quantity !== undefined ? Number(variantData.quantity) : 0,
      reserved: variantData.reserved !== undefined ? Number(variantData.reserved) : 0
    },
    unit: variantData.unit?.trim() || "piece",
    conversionRate: variantData.conversionRate !== undefined ? Number(variantData.conversionRate) : 1,
    attributes: variantData.attributes || [],
    images: variantData.images?.trim() || "",
    isDefault: variantData.isDefault || false,
    lowStockThreshold: variantData.lowStockThreshold !== undefined ? Number(variantData.lowStockThreshold) : 5,
    isActive: true
  });

  return variant;
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
      allowedSortFields: ['name', 'brand', 'createdAt', 'updatedAt'],
      defaultSortField: 'createdAt',
      defaultSortOrder: 'desc',
      searchFields: ['name', 'description', 'tags'],
      searchMaxLength: 100,
      booleanFilters: {
        isActive: true,
        hasVariants: true
      },
      exactFilters: ['categoryId', 'brand'],
      populate: 'categoryId',
      lean: true,
      baseQuery: { deletedAt: null }
    });

    const productIds = result.data.map(product => product._id);
    const variants = await ProductVariant.find({
      productId: { $in: productIds },
      isActive: true
    }).select('productId sku barcode price costPrice inventory unit conversionRate attributes images isDefault lowStockThreshold isActive').lean();

    const variantsByProduct = variants.reduce((acc, variant) => {
      if (!acc[variant.productId]) {
        acc[variant.productId] = [];
      }
      acc[variant.productId].push(variant);
      return acc;
    }, {});

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
      allowedSortFields: ['price', 'createdAt', 'updatedAt'],
      defaultSortField: 'createdAt',
      defaultSortOrder: 'desc',
      searchFields: ['sku', 'barcode'],
      searchMaxLength: 100,
      booleanFilters: {
        isActive: true,
        isDefault: true
      },
      exactFilters: ['productId'],
      populate: { path: 'productId', select: 'name categoryId brand images slug' },
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
    return errorResponse(res, "Không thể lấy danh sách biến thể", error.message);
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
      return errorResponse(res, "Định dạng ID sản phẩm không hợp lệ");
    }

    const variants = await ProductVariant.find({
      productId: id,
      isActive: true
    }).lean();

    logger.info(`Lấy danh sách biến thể của sản phẩm: ${id}`);
    return successResponse(res, "Lấy danh sách biến thể thành công", variants);
  } catch (error) {
    logger.error(`Lỗi khi lấy danh sách biến thể: ${error.message}`);
    return errorResponse(res, "Không thể lấy danh sách biến thể", error.message);
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
      return errorResponse(res, "Định dạng ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id)
      .populate("categoryId")
      .lean();

    if (!product) {
      return errorResponse(res, "Không tìm thấy sản phẩm");
    }

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
    return errorResponse(res, "Không thể lấy sản phẩm", error.message);
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
      return errorResponse(res, "Mã vạch là bắt buộc");
    }

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
      return errorResponse(res, "Không tìm thấy sản phẩm với mã vạch này");
    }

    const allVariants = await ProductVariant.find({
      productId: variant.productId._id,
      isActive: true
    }).lean();

    logger.info(`Lấy sản phẩm theo mã vạch: ${barcode}`);
    return successResponse(res, "Lấy sản phẩm thành công", {
      product: variant.productId,
      currentVariant: variant,
      allVariants
    });
  } catch (error) {
    logger.error(`Lỗi khi lấy sản phẩm theo mã vạch: ${error.message}`);
    return errorResponse(res, "Không thể lấy sản phẩm", error.message);
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
      return errorResponse(res, "Định dạng ID sản phẩm không hợp lệ");
    }

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return errorResponse(res, "Không tìm thấy sản phẩm");
    }

    if (req.body.categoryId && !mongoose.Types.ObjectId.isValid(req.body.categoryId)) {
      return errorResponse(res, "Định dạng danh mục không hợp lệ");
    }

    // Generate new slug if name is changed
    let updateData = { ...req.body };
    if (req.body.name && req.body.name !== existingProduct.name) {
      let newSlug = generateSlug(req.body.name);
      let slugExists = await Product.findOne({ slug: newSlug, _id: { $ne: id } });
      let counter = 1;
      while (slugExists) {
        newSlug = `${generateSlug(req.body.name)}-${counter}`;
        slugExists = await Product.findOne({ slug: newSlug, _id: { $ne: id } });
        counter++;
      }
      updateData.slug = newSlug;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updateData,
      { returnDocument: 'after', runValidators: true }
    ).populate("categoryId", "name");

    logger.info(`Sản phẩm được cập nhật: ${id}`);
    return successResponse(res, "Cập nhật sản phẩm thành công", updatedProduct);
  } catch (error) {
    logger.error(`Lỗi khi cập nhật sản phẩm: ${error.message}`);
    return errorResponse(res, "Không thể cập nhật sản phẩm", error.message);
  }
};


/**
 * @desc    Xóa mềm sản phẩm (soft delete)
 * @route   DELETE /api/products/:id
 */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Định dạng ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, "Không tìm thấy sản phẩm");
    }

    const variants = await ProductVariant.find({
      productId: id,
      isActive: true
    });

    if (variants.length > 0) {
      return errorResponse(res, `Không thể xóa sản phẩm có ${variants.length} biến thể đang hoạt động. Vui lòng xóa tất cả biến thể trước.`);
    }

    await Product.findByIdAndUpdate(id, { deletedAt: new Date() });

    logger.info(`Sản phẩm bị xóa mềm: ${id}`);
    return successResponse(res, "Xóa sản phẩm thành công");
  } catch (error) {
    logger.error(`Lỗi khi xóa sản phẩm: ${error.message}`);
    return errorResponse(res, "Không thể xóa sản phẩm", error.message);
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
      return errorResponse(res, "Định dạng ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, "Không tìm thấy sản phẩm");
    }

    await Product.findByIdAndDelete(id);
    await ProductVariant.deleteMany({ productId: id });

    logger.warn(`Sản phẩm bị xóa vĩnh viễn: ${id}`);
    return successResponse(res, "Xóa sản phẩm vĩnh viễn");
  } catch (error) {
    logger.error(`Lỗi khi xóa vĩnh viễn sản phẩm: ${error.message}`);
    return errorResponse(res, "Không thể xóa sản phẩm", error.message);
  }
};

/**
 * @desc    Khôi phục sản phẩm bị xóa mềm
 * @route   POST /api/products/:id/restore
 */
export const restoreProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Định dạng ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, "Không tìm thấy sản phẩm");
    }

    if (!product.deletedAt) {
      return errorResponse(res, "Sản phẩm chưa bị xóa");
    }

    await Product.findByIdAndUpdate(id, {
      deletedAt: null
    });
    await ProductVariant.updateMany(
      { productId: id },
      { isActive: true }
    );

    const restoredProduct = await Product.findById(id)
      .populate("categoryId", "name")
      .lean();

    logger.info(`Sản phẩm được khôi phục: ${id}`);
    return successResponse(res, "Khôi phục sản phẩm thành công", restoredProduct);
  } catch (error) {
    logger.error(`Lỗi khi khôi phục sản phẩm: ${error.message}`);
    return errorResponse(res, "Không thể khôi phục sản phẩm", error.message);
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
      return errorResponse(res, "Định dạng ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, "Không tìm thấy sản phẩm");
    }

    if (!variantData.sku || !variantData.price) {
      return errorResponse(res, "SKU và giá là bắt buộc");
    }

    const existingVariant = await ProductVariant.findOne({
      sku: variantData.sku,
      isActive: true
    });

    if (existingVariant) {
      return errorResponse(res, "SKU đã tồn tại");
    }

    if (variantData.barcode) {
      const existingBarcode = await ProductVariant.findOne({
        barcode: variantData.barcode,
        isActive: true
      });
      if (existingBarcode) {
        return errorResponse(res, "Mã vạch đã tồn tại");
      }
    }

    const newVariant = await ProductVariant.create({
      productId: id,
      sku: variantData.sku.trim().toUpperCase(),
      barcode: variantData.barcode?.trim() || null,
      price: variantData.price,
      costPrice: variantData.costPrice || 0,
      inventory: {
        quantity: variantData.quantity || 0,
        reserved: variantData.reserved || 0
      },
      unit: variantData.unit || "piece",
      conversionRate: variantData.conversionRate || 1,
      attributes: variantData.attributes || [],
      images: variantData.images || "",
      isDefault: variantData.isDefault || false,
      lowStockThreshold: variantData.lowStockThreshold || 5,
      isActive: true
    });

    logger.info(`Variant được thêm cho sản phẩm ${id}: ${newVariant._id}`);
    return successResponse(res, "Thêm biến thể thành công", newVariant);
  } catch (error) {
    logger.error(`Lỗi khi thêm variant: ${error.message}`);
    return errorResponse(res, "Không thể thêm biến thể", error.message);
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
      return errorResponse(res, "Định dạng ID không hợp lệ");
    }

    const variant = await ProductVariant.findOne({
      _id: variantId,
      productId: productId
    });

    if (!variant) {
      return errorResponse(res, "Không tìm thấy biến thể");
    }

    if (req.body.sku && req.body.sku !== variant.sku) {
      const duplicateSKU = await ProductVariant.findOne({
        sku: req.body.sku,
        isActive: true,
        _id: { $ne: variantId }
      });
      if (duplicateSKU) {
        return errorResponse(res, "SKU đã tồn tại");
      }
    }

    if (req.body.barcode && req.body.barcode !== variant.barcode) {
      const duplicateBarcode = await ProductVariant.findOne({
        barcode: req.body.barcode,
        isActive: true,
        _id: { $ne: variantId }
      });
      if (duplicateBarcode) {
        return errorResponse(res, "Mã vạch đã tồn tại");
      }
    }

    const updatedVariant = await ProductVariant.findByIdAndUpdate(
      variantId,
      { ...req.body },
      { returnDocument: 'after', runValidators: true }
    );

    logger.info(`Variant được cập nhật: ${variantId}`);
    return successResponse(res, "Cập nhật biến thể thành công", updatedVariant);
  } catch (error) {
    logger.error(`Lỗi khi cập nhật variant: ${error.message}`);
    return errorResponse(res, "Không thể cập nhật biến thể", error.message);
  }
};

/**
 * @desc    Cập nhật tồn kho variant
 * @route   PATCH /api/products/:productId/variants/:variantId/stock
 */
export const updateVariantStock = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { quantity, reserved, operation = "set" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
      return errorResponse(res, "Định dạng ID không hợp lệ");
    }

    if (quantity === undefined && reserved === undefined) {
      return errorResponse(res, "Giá trị tồn kho là bắt buộc");
    }

    const variant = await ProductVariant.findOne({
      _id: variantId,
      productId: productId
    });

    if (!variant) {
      return errorResponse(res, "Không tìm thấy biến thể");
    }

    let updateData = {};

    if (quantity !== undefined) {
      let newQuantity;
      switch (operation) {
        case "add":
          newQuantity = variant.inventory.quantity + Number(quantity);
          break;
        case "subtract":
          newQuantity = Math.max(0, variant.inventory.quantity - Number(quantity));
          break;
        case "set":
        default:
          newQuantity = Number(quantity);
          break;
      }
      updateData["inventory.quantity"] = newQuantity;
    }

    if (reserved !== undefined) {
      updateData["inventory.reserved"] = Number(reserved);
    }

    const updatedVariant = await ProductVariant.findByIdAndUpdate(
      variantId,
      updateData,
      { returnDocument: 'after' }
    );

    logger.info(`Tồn kho variant được cập nhật: ${variantId}`);
    return successResponse(res, "Cập nhật tồn kho thành công", updatedVariant);
  } catch (error) {
    logger.error(`Lỗi khi cập nhật tồn kho variant: ${error.message}`);
    return errorResponse(res, "Không thể cập nhật tồn kho", error.message);
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
      return errorResponse(res, "Định dạng ID không hợp lệ");
    }

    const variant = await ProductVariant.findOne({
      _id: variantId,
      productId: productId
    });

    if (!variant) {
      return errorResponse(res, "Không tìm thấy biến thể");
    }

    await ProductVariant.findByIdAndUpdate(variantId, { isActive: false });

    logger.info(`Variant bị vô hiệu hóa: ${variantId}`);
    return successResponse(res, "Vô hiệu hóa biến thể thành công");
  } catch (error) {
    logger.error(`Lỗi khi vô hiệu hóa variant: ${error.message}`);
    return errorResponse(res, "Không thể vô hiệu hóa biến thể", error.message);
  }
};