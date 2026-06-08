import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },

  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: true,
  },

  amount: {
    type: Number,
    required: true,
  },

  paymentMethod: {
    type: String,
    enum: ["cash", "bank_transfer"],
    required: true,
  },

  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending",
  },

  qrContent: String,

  qrUrl: String,

  transactionId: {
    type: Number,
    default: null,
    sparse: true,
  },

  bankName: String,

  referenceCode: String,

  paidAt: Date,
}, {
  timestamps: true,
  versionKey: false,
});

export default mongoose.model("Payment", paymentSchema);
