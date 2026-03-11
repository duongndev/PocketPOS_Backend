import mongoose from 'mongoose';
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    barcode: {
      type: String,
      required: true,
      trim: true
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    costPrice: {
      type: Number,
      required: true,
      min: 0
    },

    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// ===== INDEXES =====
productSchema.index({ barcode: 1 }, { unique: true });
productSchema.index({ name: "text" });
productSchema.index({ categoryId: 1 });
productSchema.index({ isActive: 1 });

// Additional indexes for better query performance
productSchema.index({ price: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ categoryId: 1, isActive: 1 });

// Compound index for common queries
productSchema.index({ categoryId: 1, isActive: 1, name: 1 });
productSchema.index({ isActive: 1, stock: 1 });
productSchema.index({ categoryId: 1, price: 1 });

export default mongoose.model("Product", productSchema);