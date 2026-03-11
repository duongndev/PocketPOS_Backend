import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      default: ""
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
categorySchema.index({ name: 1 }, { unique: true });
categorySchema.index({ isActive: 1 });

// Additional indexes for better query performance
categorySchema.index({ createdAt: -1 });
categorySchema.index({ isActive: 1, name: 1 });

// Compound index for common queries
categorySchema.index({ isActive: 1, createdAt: -1 });

export default mongoose.model("Category", categorySchema);