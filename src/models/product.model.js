import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    // Thuộc cửa hàng nào
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: [true, "Store là bắt buộc"],
      index: true,
    },

    // Thuộc danh mục nào
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Danh mục là bắt buộc"],
      index: true,
    },

    // Tên sản phẩm
    name: {
      type: String,
      required: [true, "Tên sản phẩm là bắt buộc"],
      trim: true,
      maxlength: [200, "Tên sản phẩm không được vượt quá 200 ký tự"],
    },

    // Mã SKU nội bộ
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    // Mã vạch dùng để quét bán hàng
    barcode: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    // Thương hiệu
    brand: {
      type: String,
      trim: true,
      default: "",
    },

    // Hình ảnh sản phẩm
    imageUrl: {
      type: String,
      default: "",
    },

    // Giá nhập
    costPrice: {
      type: Number,
      required: [true, "Giá nhập là bắt buộc"],
      min: [0, "Giá nhập không hợp lệ"],
    },

    // Giá bán
    sellingPrice: {
      type: Number,
      required: [true, "Giá bán là bắt buộc"],
      min: [0, "Giá bán không hợp lệ"],
    },

    // Tồn kho hiện tại
    stock: {
      type: Number,
      default: 0,
      min: [0, "Tồn kho không hợp lệ"],
    },

    // Đơn vị tính
    unit: {
      type: String,
      default: "Cái",
      trim: true,
    },

    // Mô tả
    description: {
      type: String,
      default: "",
      maxlength: [1000, "Mô tả không được vượt quá 1000 ký tự"],
    },

    // Trạng thái hoạt động
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/**
 * INDEXES
 */


// Tìm kiếm theo tên
productSchema.index({
  name: "text",
});

// Không cho trùng SKU trong cùng cửa hàng
productSchema.index(
  {
    storeId: 1,
    sku: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      sku: {
        $exists: true,
        $ne: null,
      },
    },
  },
);

// Không cho trùng barcode trong cùng cửa hàng
productSchema.index(
  {
    storeId: 1,
    barcode: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      barcode: {
        $exists: true,
        $ne: null,
      },
    },
  },
);

export default mongoose.model("Product", productSchema);
