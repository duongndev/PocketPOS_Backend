import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    quantity: {
      type: Number,
      default: 0,
      min: 0
    },

    reserved: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    _id: false
  }
);

const attributeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    value: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    _id: false
  }
);

const productVariantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },

    barcode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true
    },

    price: {
      type: Number,
      required: true,
      min: 0,
      index: true
    },

    costPrice: {
      type: Number,
      default: 0,
      min: 0
    },

    inventory: {
      type: inventorySchema,
      default: () => ({})
    },

    unit: {
      type: String,
      default: "piece",
      trim: true
    },

    conversionRate: {
      type: Number,
      default: 1,
      min: 1
    },

    attributes: {
      type: [attributeSchema],
      default: []
    },

    images: {
      type: String
    },

    isDefault: {
      type: Boolean,
      default: false
    },

    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// ===== INDEXES =====

productVariantSchema.index({
  productId: 1,
  isActive: 1
});

productVariantSchema.index({
  productId: 1,
  price: 1
});

productVariantSchema.index({
  productId: 1,
  isDefault: 1
});

productVariantSchema.index({
  productId: 1,
  sku: 1
});

productVariantSchema.index({
  "inventory.quantity": 1
});

productVariantSchema.index({
  createdAt: -1
});

export default mongoose.model("ProductVariant", productVariantSchema );