import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
{
  name: {
    type: String,
    required: [true, "Tên danh mục là bắt buộc"],
    trim: true,
    maxlength: [100, "Tên danh mục không được vượt quá 100 ký tự"]
  },

  slug: {
    type: String,
    unique: true,
    required: [true, "Slug là bắt buộc"],
    lowercase: true,
    trim: true
  },

  description: {
    type: String,
    default: "",
    maxlength: [500, "Mô tả không được vượt quá 500 ký tự"]
  },

  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null
  },

  sortOrder: {
    type: Number,
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
});

categorySchema.index({ parentId: 1 });

categorySchema.index({ isActive: 1 });

categorySchema.index({ parentId: 1, isActive: 1 });

categorySchema.index({ name: "text", description: "text" });


categorySchema.virtual("parent", {
  ref: "Category",
  localField: "parentId",
  foreignField: "_id",
  justOne: true
});

categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentId",
  justOne: false
});


categorySchema.methods.toJSON = function() {
  const category = this.toObject();
  delete category.__v;
  return category;
};

export default mongoose.model("Category", categorySchema);