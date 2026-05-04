import { body, param } from "express-validator";
import { validationResult } from "express-validator";

/**
 * Middleware validate dữ liệu sản phẩm (Product + Variants)
 */
export const validateProduct = [
  // Validate Product fields
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Tên sản phẩm là bắt buộc")
    .isLength({ min: 1, max: 100 })
    .withMessage("Tên sản phẩm phải có độ dài từ 1 đến 100 ký tự")
    .escape(),

  body("categoryId")
    .notEmpty()
    .withMessage("ID danh mục là bắt buộc")
    .isMongoId()
    .withMessage("ID danh mục không hợp lệ"),

  // Validate optional Product fields
  body("brand")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Thương hiệu không được vượt quá 50 ký tự")
    .escape(),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Mô tả không được vượt quá 1000 ký tự")
    .escape(),

  // body("image")
  //   .optional()
  //   .trim()
  //   .isURL()
  //   .withMessage("Hình ảnh phải là URL hợp lệ")
  //   .isLength({ max: 500 })
  //   .withMessage("URL hình ảnh không được vượt quá 500 ký tự"),

  // Validate variants array
  body("variants")
    .isArray({ min: 1 })
    .withMessage("Phải có ít nhất một biến thể sản phẩm"),

  // Validate each variant
  body("variants.*.name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Tên biến thể phải có độ dài từ 1 đến 100 ký tự")
    .escape(),

  body("variants.*.barcode")
    .trim()
    .notEmpty()
    .withMessage("Mã vạch của biến thể là bắt buộc")
    .isLength({ min: 1, max: 50 })
    .withMessage("Mã vạch phải có độ dài từ 1 đến 50 ký tự")
    .matches(/^[A-Za-z0-9\-_]+$/)
    .withMessage("Mã vạch chỉ được chứa chữ cái, số, dấu gạch ngang và gạch dưới"),

  body("variants.*.sku")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("SKU phải có độ dài từ 1 đến 50 ký tự")
    .matches(/^[A-Za-z0-9\-_]+$/)
    .withMessage("SKU chỉ được chứa chữ cái, số, dấu gạch ngang và gạch dưới"),

  body("variants.*.price")
    .notEmpty()
    .withMessage("Giá bán của biến thể là bắt buộc")
    .isFloat({ min: 0 })
    .withMessage("Giá bán phải là số và không nhỏ hơn 0")
    .toFloat(),

  body("variants.*.costPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Giá vốn phải là số và không nhỏ hơn 0")
    .toFloat(),

  body("variants.*.stock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Tồn kho phải là số nguyên và không nhỏ hơn 0")
    .toInt(),

  body("variants.*.unit")
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage("Đơn vị tính phải có độ dài từ 1 đến 20 ký tự")
    .escape(),

  body("variants.*.conversionValue")
    .optional()
    .isFloat({ min: 0.1 })
    .withMessage("Giá trị quy đổi phải là số và lớn hơn 0")
    .toFloat(),

  body("variants.*.attributes")
    .optional()
    .isObject()
    .withMessage("Thuộc tính phải là object"),

  // Xử lý kết quả validation
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return res.status(400).json({
        success: false,
        message: "Dữ liệu không hợp lệ",
        errors: errorMessages
      });
    }
    next();
  }
];

/**
 * Middleware validate ID sản phẩm trong params
 */
export const validateProductId = [
  param("id")
    .isMongoId()
    .withMessage("ID sản phẩm không hợp lệ"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "ID sản phẩm không hợp lệ",
        errors: errors.array().map(error => error.msg)
      });
    }
    next();
  }
];

/**
 * Middleware validate cập nhật sản phẩm (chỉ cập nhật Product fields)
 */
export const validateProductUpdate = [
  // Validate optional Product fields
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Tên sản phẩm phải có độ dài từ 1 đến 100 ký tự")
    .escape(),

  body("categoryId")
    .optional()
    .isMongoId()
    .withMessage("ID danh mục không hợp lệ"),

  body("brand")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Thương hiệu không được vượt quá 50 ký tự")
    .escape(),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Mô tả không được vượt quá 1000 ký tự")
    .escape(),

  body("image")
    .optional()
    .trim()
    .isURL()
    .withMessage("Hình ảnh phải là URL hợp lệ")
    .isLength({ max: 500 })
    .withMessage("URL hình ảnh không được vượt quá 500 ký tự"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("Trạng thái hoạt động phải là true hoặc false")
    .toBoolean(),

  // Xử lý kết quả validation
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return res.status(400).json({
        success: false,
        message: "Dữ liệu cập nhật sản phẩm không hợp lệ",
        errors: errorMessages
      });
    }
    next();
  }
];

/**
 * Middleware validate thêm mới variant
 */
export const validateVariant = [
  // Validate variant fields
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Tên biến thể phải có độ dài từ 1 đến 100 ký tự")
    .escape(),

  body("barcode")
    .trim()
    .notEmpty()
    .withMessage("Mã vạch là bắt buộc")
    .isLength({ min: 1, max: 50 })
    .withMessage("Mã vạch phải có độ dài từ 1 đến 50 ký tự")
    .matches(/^[A-Za-z0-9\-_]+$/)
    .withMessage("Mã vạch chỉ được chứa chữ cái, số, dấu gạch ngang và gạch dưới"),

  body("sku")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("SKU phải có độ dài từ 1 đến 50 ký tự")
    .matches(/^[A-Za-z0-9\-_]+$/)
    .withMessage("SKU chỉ được chứa chữ cái, số, dấu gạch ngang và gạch dưới"),

  body("price")
    .notEmpty()
    .withMessage("Giá bán là bắt buộc")
    .isFloat({ min: 0 })
    .withMessage("Giá bán phải là số và không nhỏ hơn 0")
    .toFloat(),

  body("costPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Giá vốn phải là số và không nhỏ hơn 0")
    .toFloat(),

  body("stock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Tồn kho phải là số nguyên và không nhỏ hơn 0")
    .toInt(),

  body("unit")
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage("Đơn vị tính phải có độ dài từ 1 đến 20 ký tự")
    .escape(),

  body("conversionValue")
    .optional()
    .isFloat({ min: 0.1 })
    .withMessage("Giá trị quy đổi phải là số và lớn hơn 0")
    .toFloat(),

  body("attributes")
    .optional()
    .isObject()
    .withMessage("Thuộc tính phải là object"),

  // Xử lý kết quả validation
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return res.status(400).json({
        success: false,
        message: "Dữ liệu biến thể không hợp lệ",
        errors: errorMessages
      });
    }
    next();
  }
];

/**
 * Middleware validate cập nhật tồn kho variant
 */
export const validateVariantStockUpdate = [
  param("productId")
    .isMongoId()
    .withMessage("ID sản phẩm không hợp lệ"),

  param("variantId")
    .isMongoId()
    .withMessage("ID biến thể không hợp lệ"),

  body("stock")
    .notEmpty()
    .withMessage("Giá trị tồn kho là bắt buộc")
    .isInt({ min: 0 })
    .withMessage("Tồn kho phải là số nguyên và không nhỏ hơn 0")
    .toInt(),

  body("operation")
    .optional()
    .isIn(["set", "add", "subtract"])
    .withMessage("Phép tính phải là set, add hoặc subtract"),

  // Xử lý kết quả validation
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return res.status(400).json({
        success: false,
        message: "Dữ liệu cập nhật tồn kho không hợp lệ",
        errors: errorMessages
      });
    }
    next();
  }
];

/**
 * Middleware validate ID sản phẩm và variant trong params
 */
export const validateProductVariantIds = [
  param("productId")
    .isMongoId()
    .withMessage("ID sản phẩm không hợp lệ"),

  param("variantId")
    .isMongoId()
    .withMessage("ID biến thể không hợp lệ"),

  // Xử lý kết quả validation
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ",
        errors: errorMessages
      });
    }
    next();
  }
];

/**
 * Middleware validate mã vạch trong params
 */
export const validateBarcode = [
  param("barcode")
    .trim()
    .notEmpty()
    .withMessage("Mã vạch là bắt buộc")
    .isLength({ min: 1, max: 50 })
    .withMessage("Mã vạch phải có độ dài từ 1 đến 50 ký tự")
    .matches(/^[A-Za-z0-9\-_]+$/)
    .withMessage("Mã vạch chỉ được chứa chữ cái, số, dấu gạch ngang và gạch dưới"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Mã vạch không hợp lệ",
        errors: errors.array().map(error => error.msg)
      });
    }
    next();
  }
];
