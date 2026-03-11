import mongoose from 'mongoose';

const inventoryLogSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },

    type: {
      type: String,
      enum: ["import", "sale", "adjust"],
      required: true
    },

    quantity: {
      type: Number,
      required: true
    },

    reference: {
      type: String, // ví dụ: orderCode
      default: ""
    },

    note: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// ===== INDEXES =====
inventoryLogSchema.index({ productId: 1, createdAt: -1 });
inventoryLogSchema.index({ type: 1 });

// Additional indexes for better query performance
inventoryLogSchema.index({ createdAt: -1 });
inventoryLogSchema.index({ reference: 1 });
inventoryLogSchema.index({ type: 1, createdAt: -1 });

// Compound index for common queries
inventoryLogSchema.index({ productId: 1, type: 1, createdAt: -1 });

export default mongoose.model('InventoryLog', inventoryLogSchema);
