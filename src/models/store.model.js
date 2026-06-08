import mongoose from "mongoose";

const storeSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    phoneNumber: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },

    logoUrl: {
      type: String,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    isCompleteProfile: {
      type: Boolean,
      default: false,
    },

    bankInfo: {
      bankCode: {
        type: String,
        default: null,
      },
      bankName: {
        type: String,
        default: null,
      },
      accountNumber: {
        type: String,
        default: null,
      },
      accountHolderName: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export default mongoose.model("Store", storeSchema);
