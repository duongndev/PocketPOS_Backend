import mongoose from "mongoose";


const productOptionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    values: [
      {
        type: String,
        trim: true
      }
    ]
  },
  {
    _id: false
  }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true
    },

    brand: {
      type: String,
      default: null,
      index: true
    },

    description: {
      type: String,
      default: ""
    },

    images: {
      type: String
    },

    hasVariants: {
      type: Boolean,
      default: false,
      index: true
    },

    options: {
      type: [productOptionSchema],
      default: []
    },

    tags: {
      type: [String],
      default: []
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// ===== TEXT SEARCH =====

productSchema.index({
  name: "text",
  description: "text",
  tags: "text"
});

// ===== FILTER INDEXES =====

productSchema.index({
  categoryId: 1,
  isActive: 1
});

productSchema.index({
  createdAt: -1
});

export default mongoose.model("Product", productSchema);