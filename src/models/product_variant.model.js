import mongoose from "mongoose";

const productVariantSchema = new mongoose.Schema(
{
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    index: true
  },

  name: {
    type: String,
    trim: true
  },

  sku: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },

  barcode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  price: {
    type: Number,
    required: true,
    min: 0
  },

  costPrice: {
    type: Number,
    default: 0,
    min: 0
  },

  stock: {
    type: Number,
    default: 0,
    min: 0,
    index: true
  },

  unit: {
    type: String,
    default: "piece"
  },

  conversionValue: {
    type: Number,
    default: 1
  },

  attributes: {
    type: Map,
    of: String
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
});

// ===== INDEXES =====

// Compound indexes for common queries
productVariantSchema.index({ productId: 1, isActive: 1 });
productVariantSchema.index({ productId: 1, price: 1 });

// Single indexes for frequent searches
productVariantSchema.index({ price: 1 });
productVariantSchema.index({ name: "text" }); // For text search on variant names

// Index for sorting by time
productVariantSchema.index({ createdAt: -1 });
productVariantSchema.index({ updatedAt: -1 });

export default mongoose.model("ProductVariant", productVariantSchema);