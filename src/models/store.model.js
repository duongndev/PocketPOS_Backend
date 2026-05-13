import mongoose from "mongoose";

const storeSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      required: [true, "Tên cửa hàng là bắt buộc"],
      trim: true,
      maxlength: [200, "Tên cửa hàng không được vượt quá 200 ký tự"]
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Mô tả không được vượt quá 500 ký tự"]
    },

    // Contact information
    phoneNumber: {
      type: String,
      trim: true,
      match: [/^[0-9]{10,11}$/, "Số điện thoại không hợp lệ"]
    },

    // Address
    address: {
      type: String,
      trim: true
    },

    // Status
    isActive: {
      type: Boolean,
      default: true
    },

    // Banking information
    bankAccount: {
      type: String,
      trim: true
    },

    bankName: {
      type: String,
      trim: true
    },

    bankBranch: {
      type: String,
      trim: true
    },

    // Store manager
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);


export default mongoose.model("Store", storeSchema);
