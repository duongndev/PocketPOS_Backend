import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    productName: {
      type: String,
      required: true,
    },

    sku: {
      type: String,
      default: null,
    },

    barcode: {
      type: String,
      default: null,
    },

    costPrice: {
      type: Number,
      required: true,
    },

    sellingPrice: {
      type: Number,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    subtotal: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false,
  },
);

const orderSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    items: [orderItemSchema],

    totalCost: {
      type: Number,
      required: true,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },

    profit: {
      type: Number,
      required: true,
      default: 0,
    },

    totalQuantity: {
      type: Number,
      default: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer"],
      default: "cash",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "paid",
    },

    note: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["completed", "cancelled"],
      default: "completed",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export default mongoose.model("Order", orderSchema);
