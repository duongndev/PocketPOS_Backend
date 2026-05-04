import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
{
  name: {
    type: String,
    required: true,
    trim: true
  },

  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
    index: true
  },

  brand: {
    type: String,
    default: "",
    index: true
  },

  description: {
    type: String,
    default: ""
  },

  image: {
    type: String,
    default: ""
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

// ===== INDEX =====

productSchema.index({ name: "text" });
productSchema.index({ description: "text" }); // For searching in descriptions
productSchema.index({ categoryId: 1, isActive: 1 });
productSchema.index({ brand: 1, isActive: 1 }); // Filter by active products of a brand
productSchema.index({ categoryId: 1, brand: 1, isActive: 1 }); // Complex filtering
productSchema.index({ createdAt: -1 });
productSchema.index({ updatedAt: -1 }); // For sorting by last update

export default mongoose.model("Product", productSchema);