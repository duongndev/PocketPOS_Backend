import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, "Key là bắt buộc"],
      unique: true,
      trim: true,
      lowercase: true
    },

    value: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Value là bắt buộc"]
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Mô tả không được vượt quá 500 ký tự"]
    },

    category: {
      type: String,
      enum: ["general", "store", "payment", "tax", "inventory", "receipt", "notification"],
      default: "general"
    },

    isPublic: {
      type: Boolean,
      default: false // If true, can be accessed without authentication
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

// Indexes for performance
settingSchema.index({ key: 1 });
settingSchema.index({ category: 1 });
settingSchema.index({ isActive: 1 });
settingSchema.index({ isPublic: 1 });

// Compound indexes for common queries
settingSchema.index({ category: 1, isActive: 1 });
settingSchema.index({ isPublic: 1, isActive: 1 });

// Static method to get setting by key
settingSchema.statics.getSetting = async function(key) {
  const setting = await this.findOne({ key, isActive: true });
  return setting ? setting.value : null;
};

// Static method to set setting
settingSchema.statics.setSetting = async function(key, value, options = {}) {
  const { description, category, isPublic } = options;
  
  const setting = await this.findOneAndUpdate(
    { key },
    {
      value,
      description,
      category,
      isPublic,
      isActive: true
    },
    { upsert: true, new: true }
  );
  
  return setting;
};

// Static method to get all settings by category
settingSchema.statics.getSettingsByCategory = async function(category) {
  const settings = await this.find({ category, isActive: true });
  return settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
};

// Static method to get all public settings
settingSchema.statics.getPublicSettings = async function() {
  const settings = await this.find({ isPublic: true, isActive: true });
  return settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
};

// toJSON method
settingSchema.methods.toJSON = function() {
  const setting = this.toObject();
  delete setting.__v;
  return setting;
};

export default mongoose.model("Setting", settingSchema);
