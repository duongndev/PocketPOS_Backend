import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true
    },
    sequence: {
      type: Number,
      default: 0
    }
  },
  {
    versionKey: false
  }
);

export default mongoose.model("Counter", counterSchema);