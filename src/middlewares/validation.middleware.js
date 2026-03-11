import { body, param } from "express-validator";
import { validationResult } from "express-validator";

/**
 * Middleware validate dữ liệu sản phẩm
 */
export const validateProduct = [
  // Validate các trường bắt buộc khi tạo sản phẩm
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Tên sản phẩm là bắt buộc")
    .isLength({ min: 1, max: 100 })
    .withMessage("Tên sản phẩm phải có độ dài từ 1 đến 100 ký tự")
    .escape(),

  body("barcode")
    .trim()
    .notEmpty()
    .withMessage("Mã vạch là bắt buộc")
    .isLength({ min: 1, max: 50 })
    .withMessage("Mã vạch phải có độ dài từ 1 đến 50 ký tự")
    .matches(/^[A-Za-z0-9\-_]+$/)
    .withMessage("Mã vạch chỉ được chứa chữ cái, số, dấu gạch ngang và gạch dưới"),

  body("categoryId")
    .notEmpty()
    .withMessage("ID danh mục là bắt buộc")
    .isMongoId()
    .withMessage("ID danh mục không hợp lệ"),

  // Validate các trường tùy chọn
  body("price")
    .optional()
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

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Mô tả không được vượt quá 500 ký tự")
    .escape(),

  body("minStock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Tồn kho tối thiểu phải là số nguyên và không nhỏ hơn 0")
    .toInt(),

  body("maxStock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Tồn kho tối đa phải là số nguyên và không nhỏ hơn 0")
    .toInt(),

  body("unit")
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage("Đơn vị tính phải có độ dài từ 1 đến 20 ký tự")
    .escape(),

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
 * Middleware validate cập nhật tồn kho
 */
export const validateStockUpdate = [
  param("id")
    .isMongoId()
    .withMessage("ID sản phẩm không hợp lệ"),

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
