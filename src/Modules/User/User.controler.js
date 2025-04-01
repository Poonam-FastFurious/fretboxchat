import { User } from "./User.model.js";
import bcrypt from "bcryptjs";

import { generateToken } from "../../lib/utils.js";

import cloudinary from "../../lib/cloudinary.js";

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return null; // User not found case
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating tokens:", error);
    return null; // Error handling
  }
};

export const signup = async (req, res) => {
  const { fullName, email, password, role, admin } = req.body;

  try {
    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // New user object
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      role,
    });

    // Role-based logic
    if (role === "User") {
      if (!admin) {
        return res
          .status(400)
          .json({ message: "Admin ID is required for Users" });
      }

      const adminUser = await User.findById(admin);
      if (!adminUser || adminUser.role !== "Admin") {
        return res.status(400).json({ message: "Invalid Admin ID" });
      }

      newUser.admin = admin;
      newUser.superAdmin = adminUser.superAdmin; // Auto-assign SuperAdmin from Admin
    }

    if (role === "Admin") {
      if (!req.body.superAdmin) {
        return res
          .status(400)
          .json({ message: "SuperAdmin ID is required for Admins" });
      }

      const superAdminUser = await User.findById(req.body.superAdmin);
      if (!superAdminUser || superAdminUser.role !== "SuperAdmin") {
        return res.status(400).json({ message: "Invalid SuperAdmin ID" });
      }

      newUser.superAdmin = req.body.superAdmin; // Assign SuperAdmin to Admin
    }

    // Save user
    await newUser.save();

    // Generate JWT token
    generateToken(newUser._id, res);

    // Response
    res.status(201).json({
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      admin: newUser.admin,
      superAdmin: newUser.superAdmin,
    });
  } catch (error) {
    console.error("Error in signup controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export const login = async (req, res) => {
  const { email, password, fretBoxUserId, role, admin, superAdmin } = req.body;

  try {
    let user = await User.findOne({ email });

    if (!user) {
      if (!fretBoxUserId || isNaN(fretBoxUserId)) {
        return res
          .status(400)
          .json({ message: "Valid Fretbox User ID is required" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      let assignedRole = role || "User";

      let adminObjectId = null;
      let superAdminObjectId = null;

      if (admin) {
        const adminUser = await User.findOne({ fretBoxUserId: Number(admin) });

        if (!adminUser || adminUser.role !== "Admin") {
          return res.status(400).json({ message: "Invalid Admin ID" });
        }

        adminObjectId = adminUser._id;
        superAdminObjectId = adminUser.superAdmin; // Automatically assigning SuperAdmin from Admin
      }

      if (superAdmin) {
        const superAdminUser = await User.findOne({
          fretBoxUserId: Number(superAdmin),
        });

        if (!superAdminUser) {
          return res.status(400).json({ message: "Invalid SuperAdmin ID" });
        }

        superAdminObjectId = superAdminUser._id;
      }

      const newUser = new User({
        email,
        fullName: req.body.fullName || email.split("@")[0],
        password: hashedPassword,
        fretBoxUserId: Number(fretBoxUserId),
        role: assignedRole,
        admin: assignedRole === "User" ? adminObjectId : null,
        superAdmin:
          assignedRole === "User"
            ? superAdminObjectId
            : assignedRole === "Admin"
            ? superAdminObjectId || null
            : null,
      });

      user = await newUser.save();
    } else {
      const isPasswordCorrect = await bcrypt.compare(password, user.password);

      if (!isPasswordCorrect) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      let updateFields = {};

      if (role && role !== user.role) {
        updateFields.role = role;
      }

      if (admin && user.role === "User") {
        const adminUser = await User.findOne({ fretBoxUserId: Number(admin) });
        if (!adminUser || adminUser.role !== "Admin") {
          return res.status(400).json({ message: "Invalid Admin ID" });
        }

        updateFields.admin = adminUser._id;
        updateFields.superAdmin = adminUser.superAdmin; // Automatically update SuperAdmin
      }

      if (superAdmin && user.role === "Admin") {
        const superAdminUser = await User.findOne({
          fretBoxUserId: Number(superAdmin),
        });
        if (!superAdminUser) {
          return res.status(400).json({ message: "Invalid SuperAdmin ID" });
        }
        updateFields.superAdmin = superAdminUser._id;
      }

      if (Object.keys(updateFields).length > 0) {
        user = await User.findByIdAndUpdate(user._id, updateFields, {
          new: true,
        });
      }
    }

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        profilePic: user.profilePic,
        fretBoxUserId: user.fretBoxUserId,
        role: user.role,
        admin: user.admin,
        superAdmin: user.superAdmin,
        accessToken,
        refreshToken,
      });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


// export const login = async (req, res) => {
//   const { email, password } = req.body;
//   try {
//     const user = await User.findOne({ email });

//     if (!user) {
//       return res.status(400).json({ message: "Invalid credentials" });
//     }
//     const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
//       user._id
//     );
//     const isPasswordCorrect = await bcrypt.compare(password, user.password);
//     if (!isPasswordCorrect) {
//       return res.status(400).json({ message: "Invalid credentials" });
//     }

//     const options = {
//       httpOnly: true,
//       secure: true,
//     };
//     res
//       .status(200)
//       .cookie("accessToken", accessToken, options)
//       .cookie("refreshToken", refreshToken, options)
//       .json({
//         _id: user._id,
//         fullName: user.fullName,
//         email: user.email,
//         profilePic: user.profilePic,
//         accessToken,
//         refreshToken,
//       });
//   } catch (error) {
//     console.log("Error in login controller", error.message);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// };

export const getUserList = async (req, res) => {
  try {
    const { role } = req.query; // Extract role from query params
    let filter = {};

    if (role) {
      filter.role = role; // Apply role filter if provided
    }

    const users = await User.find(filter).select("-password -refreshToken"); // Exclude password and refreshToken
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUsersForChat = async (req, res) => {
  try {
    const { role, _id, admin, superAdmin } = req.user; // Extract from authenticated user

    let users = [];

    if (role === "SuperAdmin") {
      // Get only Admins and Users under this SuperAdmin, excluding self
      users = await User.find({
        $or: [
          { role: "Admin", superAdmin: _id },
          { role: "User", superAdmin: _id },
        ],
        _id: { $ne: _id }, // Exclude requesting user
      }).select("-password -refreshToken");
    } else if (role === "Admin") {
      // Get Users under this Admin, other Admins under the same SuperAdmin, and their own SuperAdmin, excluding self
      users = await User.find({
        $or: [
          { role: "User", admin: _id }, // Users under this Admin
          { role: "Admin", superAdmin: superAdmin }, // Other Admins under the same SuperAdmin
          { role: "SuperAdmin", _id: superAdmin }, // Their own SuperAdmin
        ],
        _id: { $ne: _id }, // Exclude requesting user
      }).select("-password -refreshToken");
    } else if (role === "User") {
      // Get their Admin, their SuperAdmin, and other Users under the same Admin, excluding self
      users = await User.find({
        $or: [
          { role: "Admin", _id: admin }, // Their Admin
          { role: "SuperAdmin", _id: superAdmin }, // Their SuperAdmin
          { role: "User", admin: admin }, // Other Users under the same Admin
        ],
        _id: { $ne: _id }, // Exclude requesting user
      }).select("-password -refreshToken");
    } else {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users for chat:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = async (req, res) => {
  try {
    res
      .status(200)
      .clearCookie("accessToken", { httpOnly: true, secure: true })
      .clearCookie("refreshToken", { httpOnly: true, secure: true })
      .json({ message: "User logged out successfully" });
  } catch (error) {
    console.error("Error in logout controller:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const currentUser = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    res.status(200).json({
      _id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      profilePic: req.user.profilePic,
      admin: req.user.admin,
      superAdmin: req.user.superAdmin,
    });
  } catch (error) {
    console.error("Error fetching current user:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({ message: "Profile pic is required" });
    }

    // Upload to Cloudinary
    const uploadResponse = await cloudinary.uploader.upload_stream(
      { resource_type: "image" },
      async (error, result) => {
        if (error) {
          console.log("Cloudinary upload error:", error);
          return res.status(500).json({ message: "Image upload failed" });
        }

        // Update user profile picture in database
        const updatedUser = await User.findByIdAndUpdate(
          userId,
          { profilePic: result.secure_url },
          { new: true }
        );

        res.status(200).json(updatedUser);
      }
    );

    uploadResponse.end(req.file.buffer);
  } catch (error) {
    console.log("Error in update profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const userId = req.user._id; // Authenticated user ID
    const { fullName, email } = req.body;

    // Fetch existing user
    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update only if values are provided, otherwise keep existing values
    user.fullName = fullName || user.fullName;
    user.email = email || user.email;

    // Save updated user
    await user.save();

    // Response
    res.json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
    });
  } catch (error) {
    console.error("Error updating user:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const crmLogin = async (req, res) => {
  const { fullName, email, profilePic, role, admin, superAdmin, mysqlId } =
    req.body;

  try {
    if (!email || !role) {
      return res.status(400).json({ message: "Email and Role are required" });
    }

    let user = await User.findOne({ email });

    let mongoAdmin = null;
    let mongoSuperAdmin = null;

    // ✅ Agar Admin Login kar raha hai, uske SuperAdmin ka MongoDB ID map karo
    if (role === "Admin" && superAdmin) {
      const superAdminUser = await User.findOne({ mysqlId: superAdmin });
      if (!superAdminUser || superAdminUser.role !== "SuperAdmin") {
        return res.status(400).json({ message: "Invalid SuperAdmin ID" });
      }
      mongoSuperAdmin = superAdminUser._id;
    }

    // ✅ Agar User Login kar raha hai, uske Admin ka MongoDB ID map karo
    if (role === "User" && admin) {
      const adminUser = await User.findOne({ mysqlId: admin });
      if (!adminUser || adminUser.role !== "Admin") {
        return res.status(400).json({ message: "Invalid Admin ID" });
      }
      mongoAdmin = adminUser._id;
    }

    // ✅ Agar user nahi mila, to create karo
    if (!user) {
      user = new User({
        fullName: fullName || "Unknown User",
        email,
        password: "",
        role,
        profilePic: profilePic || "",
        admin: mongoAdmin,
        superAdmin: mongoSuperAdmin,
        mysqlId: mysqlId || null,
      });
      await user.save();
    } else {
      // ✅ Agar pehle se hai, to update karo
      let updatedFields = {};
      if (mongoAdmin && !user.admin) updatedFields.admin = mongoAdmin;
      if (mongoSuperAdmin && !user.superAdmin)
        updatedFields.superAdmin = mongoSuperAdmin;

      if (Object.keys(updatedFields).length > 0) {
        await User.updateOne({ _id: user._id }, { $set: updatedFields });
      }
    }

    // ✅ Check karo ki koi users orphan (admin/superAdmin null) to nahi hain, update them
    if (role === "Admin") {
      await User.updateMany(
        { admin: null, mysqlAdmin: mysqlId }, // Jo admin ke under hone chahiye
        { $set: { admin: user._id } }
      );
    }

    if (role === "SuperAdmin") {
      await User.updateMany(
        { superAdmin: null, mysqlSuperAdmin: mysqlId }, // Jo superAdmin ke under hone chahiye
        { $set: { superAdmin: user._id } }
      );
    }

    // ✅ Tokens generate karna
    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
      user._id
    );
    if (!accessToken || !refreshToken) {
      return res.status(500).json({ message: "Token generation failed" });
    }

    res
      .status(200)
      .cookie("accessToken", accessToken, { httpOnly: true, secure: true })
      .cookie("refreshToken", refreshToken, { httpOnly: true, secure: true })
      .json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        admin: user.admin,
        superAdmin: user.superAdmin,
        profilePic: user.profilePic,
        mysqlId: user.mysqlId,
        accessToken,
        refreshToken,
      });
  } catch (error) {
    console.error("Error in CRM login:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password"); // Exclude password for security

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};