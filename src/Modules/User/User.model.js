import mongoose from "mongoose";

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
      required: true,
      minlength: 6,
    },
    profilePic: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["User", "Admin", "SuperAdmin"],
      default: "User",
    },
    superAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to College (SuperAdmin)
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to Warden (Admin)
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

export const User = mongoose.model("User", userSchema);
