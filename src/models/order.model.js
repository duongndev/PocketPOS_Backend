import mongoose from 'mongoose';
const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },

    name: {
      type: String,
      required: true
    },

    price: {
      type: Number,
      required: true
    },

    costPrice: {
      type: Number,
      required: true
    },

    quantity: {
      type: Number,
      required: true,
      min: 1
    },

    total: {
      type: Number,
      required: true
    },

    profit: {
      type: Number,
      required: true
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      required: true,
      unique: true
    },

    items: {
      type: [orderItemSchema],
      validate: [arr => arr.length > 0, "Order must have at least one item"]
    },

    totalAmount: {
      type: Number,
      required: true
    },

    totalProfit: {
      type: Number,
      required: true
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "transfer"],
      default: "cash"
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// ===== INDEXES =====
orderSchema.index({ orderCode: 1 }, { unique: true });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ createdAt: -1, paymentMethod: 1 });

// Additional indexes for better query performance
orderSchema.index({ totalAmount: -1 });
orderSchema.index({ totalProfit: -1 });
orderSchema.index({ paymentMethod: 1 });
orderSchema.index({ "items.productId": 1 });

// Compound index for common queries
orderSchema.index({ createdAt: -1, paymentMethod: 1, totalAmount: -1 });

export default mongoose.model("Order", orderSchema);