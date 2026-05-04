import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true
    },

    snapshot: {
      productName: {
        type: String,
        required: true
      },
      variantName: {
        type: String,
        default: ""
      },
      sku: {
        type: String,
        default: ""
      },
      barcode: {
        type: String,
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
      attributes: {
        type: Map,
        of: String
      }
    },

    quantity: {
      type: Number,
      required: true,
      min: 1
    },

    total: {
      type: Number,
      required: true,
      min: 0
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
      unique: true,
      index: true
    },

    status: {
      type: String,
      enum: ["pending", "completed", "cancelled", "refunded"],
      default: "pending",
      index: true
    },

    items: {
      type: [orderItemSchema],
      validate: [arr => arr.length > 0, "Order must have at least one item"]
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    taxAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },

    totalProfit: {
      type: Number,
      required: true
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "transfer"],
      default: "cash",
      index: true
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
      index: true
    },

    notes: {
      type: String,
      default: "",
      maxlength: 1000
    },

    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    cancelledAt: {
      type: Date,
      default: null
    },

    cancelledReason: {
      type: String,
      default: "",
      maxlength: 500
    },

    refundedAt: {
      type: Date,
      default: null
    },

    refundedAmount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// ===== INDEXES =====
// Basic indexes
orderSchema.index({ orderCode: 1 }, { unique: true });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ staffId: 1 });

// Payment and status related indexes
orderSchema.index({ createdAt: -1, status: 1 });
orderSchema.index({ createdAt: -1, paymentStatus: 1 });
orderSchema.index({ createdAt: -1, paymentMethod: 1 });
orderSchema.index({ status: 1, paymentStatus: 1 });

// Performance indexes
orderSchema.index({ totalAmount: -1 });
orderSchema.index({ totalProfit: -1 });
orderSchema.index({ paymentMethod: 1 });

// Product related indexes
orderSchema.index({ "items.productId": 1 });
orderSchema.index({ "items.variantId": 1 });
orderSchema.index({ "items.productId": 1, "items.variantId": 1 });

// Compound indexes for common queries
orderSchema.index({ createdAt: -1, status: 1, paymentMethod: 1 });
orderSchema.index({ createdAt: -1, status: 1, totalAmount: -1 });
orderSchema.index({ staffId: 1, createdAt: -1 });

// Search indexes
orderSchema.index({ orderCode: "text" });
orderSchema.index({ notes: "text" });

// Virtual for calculating total quantity
orderSchema.virtual('totalQuantity').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for checking if order is paid
orderSchema.virtual('isPaid').get(function() {
  return this.paymentStatus === 'paid';
});

// Virtual for checking if order can be cancelled
orderSchema.virtual('canBeCancelled').get(function() {
  return this.status === 'pending' && this.paymentStatus !== 'paid';
});

// Pre-save middleware to ensure data consistency
orderSchema.pre('save', function(next) {
  // Validate totalAmount matches sum of items
  const calculatedTotal = this.items.reduce((sum, item) => sum + item.total, 0) 
    - this.discountAmount + this.taxAmount;
  
  if (Math.abs(this.totalAmount - calculatedTotal) > 0.01) {
    this.totalAmount = calculatedTotal;
  }
  
  // Set cancelledAt if status is cancelled
  if (this.status === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }
  
  // Set refundedAt if status is refunded
  if (this.status === 'refunded' && !this.refundedAt) {
    this.refundedAt = new Date();
  }
  
  next();
});

// Static method to generate order code
orderSchema.statics.generateOrderCode = function() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${year}${month}${day}${random}`;
};

// Static method to get order statistics
orderSchema.statics.getStats = function(startDate, endDate) {
  const matchStage = {};
  if (startDate && endDate) {
    matchStage.createdAt = { $gte: startDate, $lte: endDate };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        totalProfit: { $sum: '$totalProfit' },
        avgOrderValue: { $avg: '$totalAmount' },
        paidOrders: {
          $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        }
      }
    }
  ]);
};

export default mongoose.model("Order", orderSchema);