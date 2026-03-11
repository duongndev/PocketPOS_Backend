import mongoose from 'mongoose';

const revenueSchema = new mongoose.Schema(
  {
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    year: {
      type: Number,
      required: true
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    totalCost: {
      type: Number,
      default: 0
    },
    totalProfit: {
      type: Number,
      default: 0
    },
    totalInvoices: {
      type: Number,
      default: 0
    },
    totalItems: {
      type: Number,
      default: 0
    },
    paymentBreakdown: {
      cash: {
        type: Number,
        default: 0
      },
      transfer: {
        type: Number,
        default: 0
      },
      other: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// ===== INDEXES =====
// Ensure one document per month-year combination
revenueSchema.index({ month: 1, year: 1 }, { unique: true });

// Additional indexes for better query performance
revenueSchema.index({ year: -1 });
revenueSchema.index({ totalRevenue: -1 });
revenueSchema.index({ totalProfit: -1 });
revenueSchema.index({ createdAt: -1 });

// Compound index for common queries
revenueSchema.index({ year: -1, month: -1, totalRevenue: -1 });

export default mongoose.model('Revenue', revenueSchema);
