import mongoose from "mongoose";
import jwt from "jsonwebtoken";
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      minlength: 6,
    },
    phone: {
      type: String,
    },

    profilePic: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      default: "User",
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
    },
    refreshToken: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);
userSchema.pre("save", async function (next) {
  if (this.role === "User" && this.admin) {
    const admin = await mongoose.model("User").findById(this.admin);
    if (admin && admin.superAdmin) {
      this.superAdmin = admin.superAdmin; // Auto-assign SuperAdmin from Admin
    }
  }
  next();
});
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      fullName: this.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};
export const User = mongoose.model("User", userSchema);
