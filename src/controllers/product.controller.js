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
    const { name, categoryId, brand, description, image, variants } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!name || !categoryId) {
      return errorResponse(res, "Tên sản phẩm và danh mục là bắt buộc");
    }

    // Kiểm tra định dạng ObjectId
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return errorResponse(res, "Định dạng danh mục không hợp lệ");
    }

    // Kiểm tra variants
    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return errorResponse(res, "Phải có ít nhất một biến thể sản phẩm");
    }

    // Validate variants
    for (const variant of variants) {
      if (!variant.barcode || !variant.price) {
        return errorResponse(res, "Mỗi biến thể phải có mã vạch và giá");
      }
    }

    // Kiểm tra barcode đã tồn tại chưa
    const barcodes = variants.map(v => v.barcode);
    const existingVariants = await ProductVariant.find({ 
      barcode: { $in: barcodes },
      isActive: true 
    });
    
    if (existingVariants.length > 0) {
      const existingBarcodes = existingVariants.map(v => v.barcode);
      return errorResponse(res, `Mã vạch đã tồn tại: ${existingBarcodes.join(', ')}`);
    }

    // Tạo sản phẩm
    const product = await Product.create({
      name,
      categoryId,
      brand: brand || "",
      description: description || "",
      image: image || "",
      isActive: true
    });

    // Tạo variants

    let productVariants;
    try {
      productVariants = await Promise.all(
        variants.map(variant => 
          ProductVariant.create({
            productId: product._id,
            name: variant.name || name,
            barcode: variant.barcode,
            sku: variant.sku,
            price: variant.price,
            costPrice: variant.costPrice || 0,
            stock: variant.stock || 0,
            unit: variant.unit || "piece",
            conversionValue: variant.conversionValue || 1,
            attributes: variant.attributes || {},
            isActive: true
          })
        )
      );
    } catch (error) {
      logger.error(`Lỗi khi tạo biến thể sản phẩm: ${error.message}`);
      return errorResponse(res, "Không thể tạo biến thể sản phẩm", error.message);
    }

    // const productVariants = await Promise.all(
    //   variants.map(variant => 
    //     ProductVariant.create({
    //       productId: product._id,
    //       name: variant.name || name,
    //       barcode: variant.barcode,
    //       sku: variant.sku,
    //       price: variant.price,
    //       costPrice: variant.costPrice || 0,
    //       stock: variant.stock || 0,
    //       unit: variant.unit || "piece",
    //       conversionValue: variant.conversionValue || 1,
    //       attributes: variant.attributes || {},
    //       isActive: true
    //     })
    //   )
    // );

    // Populate và trả về kết quả
    const newProduct = await Product.findById(product._id)
      .populate("categoryId", "name")
      .lean();

    logger.info(`Sản phẩm được tạo: ${product._id} với ${productVariants.length} variants`);
    return successResponse(res, "Tạo sản phẩm thành công", {
      product: newProduct,
      variants: productVariants
    });
  } catch (error) {
    logger.error(`Lỗi khi tạo sản phẩm: ${error.message}`);
    return errorResponse(res, "Không thể tạo sản phẩm", error.message);
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

    // Get variants for each product
    const productsWithVariants = await Promise.all(
      result.data.map(async (product) => {
        const variants = await ProductVariant.find({ 
          productId: product._id, 
          isActive: true 
        }).select('name barcode sku price stock unit attributes').lean();
        
        return {
          ...product,
          variants
        };
      })
    );

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
      .populate("categoryId", "name")
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
      { new: true, runValidators: true }
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
      { new: true, runValidators: true }
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
      { new: true }
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