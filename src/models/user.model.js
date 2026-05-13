import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Tên đăng nhập là bắt buộc"],
      unique: true,
      trim: true,
      minlength: [3, "Tên đăng nhập phải có ít nhất 3 ký tự"],
      maxlength: [50, "Tên đăng nhập không được vượt quá 50 ký tự"]
    },

    email: {
      type: String,
      required: [true, "Email là bắt buộc"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"]
    },

    password: {
      type: String,
      required: [true, "Mật khẩu là bắt buộc"],
      minlength: [6, "Mật khẩu phải có ít nhất 6 ký tự"],
      select: false // Don't return password by default
    },

    fullName: {
      type: String,
      required: [true, "Họ tên là bắt buộc"],
      trim: true,
      maxlength: [100, "Họ tên không được vượt quá 100 ký tự"]
    },

    phone: {
      type: String,
      trim: true,
      match: [/^[0-9]{10,11}$/, "Số điện thoại không hợp lệ"]
    },

    role: {
      type: String,
      enum: ["superadmin", "admin", "staff"],
      default: "admin"
    },

    avatar: {
      type: String,
      default: ""
    },

    address: {
      type: String,
      trim: true,
      maxlength: [200, "Địa chỉ không được vượt quá 200 ký tự"]
    },

    lastLoginAt: {
      type: Date,
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    },

    permissions: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export default mongoose.model("User", userSchema);
