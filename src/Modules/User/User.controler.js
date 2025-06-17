import { User } from "./User.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../../lib/cloudinary.js";
import { Community } from "../Community/Community.model.js";

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
    res.status(500).json({ message: error.message });
  }
};

// export const getUsersForChat = async (req, res) => {
//   try {
//     const { role, _id, admin, superAdmin } = req.user; // Extract from authenticated user
//     const { userId, userRole } = req.query; // Query parameters for filtering

//     let filter = { _id: { $ne: _id } }; // Exclude requesting user

//     if (userId) {
//       // If specific userId is provided, fetch only that user
//       filter._id = userId;
//     } else if (userRole) {
//       // If specific role is provided, filter users based on role hierarchy
//       if (role === "SuperAdmin") {
//         if (userRole === "Admin") filter = { role: "Admin", superAdmin: _id };
//         else if (userRole === "User")
//           filter = { role: "User", superAdmin: _id };
//       } else if (role === "Admin") {
//         if (userRole === "User") filter = { role: "User", admin: _id };
//         else if (userRole === "Admin")
//           filter = { role: "Admin", superAdmin: superAdmin };
//       } else if (role === "User") {
//         if (userRole === "Admin") filter = { role: "Admin", _id: admin };
//         else if (userRole === "SuperAdmin")
//           filter = { role: "SuperAdmin", _id: superAdmin };
//         else if (userRole === "User") filter = { role: "User", admin: admin };
//       }
//     } else {
//       // Default case: Fetch all users under respective hierarchy
//       if (role === "SuperAdmin") {
//         filter.$or = [
//           { role: "Admin", superAdmin: _id },
//           { role: "User", superAdmin: _id },
//         ];
//       } else if (role === "Admin") {
//         filter.$or = [
//           { role: "User", admin: _id },
//           { role: "Admin", superAdmin: superAdmin },
//           { role: "SuperAdmin", _id: superAdmin },
//         ];
//       } else if (role === "User") {
//         filter.$or = [
//           { role: "Admin", _id: admin },
//           { role: "SuperAdmin", _id: superAdmin },
//           { role: "User", admin: admin },
//         ];
//       }
//     }

//     const users = await User.find(filter).select("-password -refreshToken");

//     res.status(200).json(users);
//   } catch (error) {
//     console.error("Error fetching users for chat:", error.message);
//     res.status(500).json({ message: error.message });
//   }
// };

export const logout = async (req, res) => {
  try {
    res
      .status(200)
      .clearCookie("accessToken", { httpOnly: true, secure: true })
      .clearCookie("refreshToken", { httpOnly: true, secure: true })
      .json({ message: "User logged out successfully" });
  } catch (error) {
    console.error("Error in logout controller:", error);
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
          return res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
};

// export const signup = async (req, res) => {
//   const { fullName, email, password, role, admin } = req.body;

//   try {
//     if (!fullName || !email || !password || !role) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     if (password.length < 6) {
//       return res
//         .status(400)
//         .json({ message: "Password must be at least 6 characters" });
//     }

//     // Check if user already exists
//     const existingUser = await User.findOne({ email });
//     if (existingUser)
//       return res.status(400).json({ message: "Email already exists" });

//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     // New user object
//     const newUser = new User({
//       fullName,
//       email,
//       password: hashedPassword,
//       role,
//     });

//     // Role-based logic
//     if (role === "User") {
//       if (!admin) {
//         return res
//           .status(400)
//           .json({ message: "Admin ID is required for Users" });
//       }

//       const adminUser = await User.findById(admin);
//       if (!adminUser || adminUser.role !== "Admin") {
//         return res.status(400).json({ message: "Invalid Admin ID" });
//       }

//       newUser.admin = admin;
//       newUser.superAdmin = adminUser.superAdmin; // Auto-assign SuperAdmin from Admin
//     }

//     if (role === "Admin") {
//       if (!req.body.superAdmin) {
//         return res
//           .status(400)
//           .json({ message: "SuperAdmin ID is required for Admins" });
//       }

//       const superAdminUser = await User.findById(req.body.superAdmin);
//       if (!superAdminUser || superAdminUser.role !== "SuperAdmin") {
//         return res.status(400).json({ message: "Invalid SuperAdmin ID" });
//       }

//       newUser.superAdmin = req.body.superAdmin; // Assign SuperAdmin to Admin
//     }

//     // Save user
//     await newUser.save();

//     // Generate JWT token
//     generateToken(newUser._id, res);

//     // Response
//     res.status(201).json({
//       _id: newUser._id,
//       fullName: newUser.fullName,
//       email: newUser.email,
//       role: newUser.role,
//       admin: newUser.admin,
//       superAdmin: newUser.superAdmin,
//     });
//   } catch (error) {
//     console.error("Error in signup controller:", error.message);
//     res.status(500).json({ message: error.message });
//   }
// };

// export const login = async (req, res) => {
//   const { email, fretBoxUserId, role, admin, superAdmin } = req.body;
//   const defaultPassword = "123456";
//   try {
//     let user = await User.findOne({ email });

//     if (!user) {
//       if (!fretBoxUserId || isNaN(fretBoxUserId)) {
//         return res
//           .status(400)
//           .json({ message: "Valid Fretbox User ID is required" });
//       }

//       const hashedPassword = await bcrypt.hash(defaultPassword, 10); // Hash the default password
//       let assignedRole = role || "User";

//       let adminObjectId = null;
//       let superAdminObjectId = null;

//       if (admin) {
//         const adminUser = await User.findOne({ fretBoxUserId: Number(admin) });

//         if (!adminUser || adminUser.role !== "Admin") {
//           return res.status(400).json({ message: "Invalid Admin ID" });
//         }

//         adminObjectId = adminUser._id;
//         superAdminObjectId = adminUser.superAdmin; // Automatically assigning SuperAdmin from Admin
//       }

//       if (superAdmin) {
//         const superAdminUser = await User.findOne({
//           fretBoxUserId: Number(superAdmin),
//         });

//         if (!superAdminUser) {
//           return res.status(400).json({ message: "Invalid SuperAdmin ID" });
//         }

//         superAdminObjectId = superAdminUser._id;
//       }

//       const newUser = new User({
//         email,
//         fullName: req.body.fullName || email.split("@")[0],
//         password: hashedPassword, // Use the hashed default password
//         fretBoxUserId: Number(fretBoxUserId),
//         role: assignedRole,
//         admin: assignedRole === "User" ? adminObjectId : null,
//         superAdmin:
//           assignedRole === "User"
//             ? superAdminObjectId
//             : assignedRole === "Admin"
//             ? superAdminObjectId || null
//             : null,
//       });

//       user = await newUser.save();
//     } else {
//       // Skip the password verification since we don't want to pass a password
//       let updateFields = {};

//       if (role && role !== user.role) {
//         updateFields.role = role;
//       }

//       if (admin && user.role === "User") {
//         const adminUser = await User.findOne({ fretBoxUserId: Number(admin) });
//         if (!adminUser || adminUser.role !== "Admin") {
//           return res.status(400).json({ message: "Invalid Admin ID" });
//         }

//         updateFields.admin = adminUser._id;
//         updateFields.superAdmin = adminUser.superAdmin; // Automatically update SuperAdmin
//       }

//       if (superAdmin && user.role === "Admin") {
//         const superAdminUser = await User.findOne({
//           fretBoxUserId: Number(superAdmin),
//         });
//         if (!superAdminUser) {
//           return res.status(400).json({ message: "Invalid SuperAdmin ID" });
//         }
//         updateFields.superAdmin = superAdminUser._id;
//       }

//       if (Object.keys(updateFields).length > 0) {
//         user = await User.findByIdAndUpdate(user._id, updateFields, {
//           new: true,
//         });
//       }
//     }

//     const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
//       user._id
//     );

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
//         fretBoxUserId: user.fretBoxUserId,
//         role: user.role,
//         admin: user.admin,
//         superAdmin: user.superAdmin,
//         accessToken,
//         refreshToken,
//       });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

export const signup = async (req, res) => {
  const {
    fullName,
    email,
    password,
    phone,
    role,
    profilePic,
    communityId, // user provides this
  } = req.body;

  try {
    if (!fullName || !email || !password || !communityId) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided." });
    }

    // 1. Find the community by its communityId (e.g., "F230041")
    const community = await Community.findOne({ communityId });
    if (!community) {
      return res.status(404).json({ message: "Community not found." });
    }

    // 2. Check for existing user
    const existingUser = await User.findOne({ $or: [{ email }] });
    if (existingUser) {
      return res.status(409).json({ message: "Email  already in use." });
    }

    // 3. Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create and save the user with community._id
    const user = new User({
      fullName,
      email,
      password: hashedPassword,
      phone,
      profilePic,
      role,
      community: community._id, // This is the actual ObjectId
    });

    await user.save();

    // 5. Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save();

    // 6. Respond
    return res.status(201).json({
      message: "User created successfully",
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        community: {
          communityId: community.communityId,
          name: community.name,
          description: community.description,
        },
      },
    });
  } catch (err) {
    console.error("Signup Error:", err);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: err.message });
  }
};
export const login = async (req, res) => {
  const { email, password, communityId } = req.body;

  try {
    // Check for missing fields
    if (!email || !password || !communityId) {
      return res
        .status(400)
        .json({ message: "Email and password and communityId  are required" });
    }

    // Find user by email
    const user = await User.findOne({ email }).populate("community");

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!user.community || user.community.communityId !== communityId) {
      return res
        .status(403)
        .json({ message: "User does not belong to this organization" });
    }
    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
      user._id
    );

    // Set tokens in cookies
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

        role: user.role,
        community: {
          communityId: user.community.communityId,
          name: user.community.name,
          description: user.community.description,
        },
        accessToken,
        refreshToken,
      });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const getUsersForChat = async (req, res) => {
  try {
    const { _id, community } = req.user; // logged-in user info

    if (!community) {
      return res
        .status(400)
        .json({ message: "Community not found in user token." });
    }

    const users = await User.find({
      _id: { $ne: _id }, // exclude current user
      community: community, // same community only
    }).select("-password -refreshToken");

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users for chat:", error.message);
    res.status(500).json({ message: error.message });
  }
};

export const checkUserExists = async (req, res) => {
  const { email } = req.query;

  try {
    if (!email) {
      return res.status(400).json({ message: "Missing email" });
    }

    const user = await User.findOne({ email });

    res.json({ exists: !!user });
  } catch (err) {
    console.error("Check user error:", err);
    res.status(500).json({ message: "Internal error", error: err.message });
  }
};

export const checkSignupOrLogin = async (req, res) => {
  const {
    fullName,
    email,
    password,
    phone,
    role,
    profilePic,
    communityId,
  } = req.body;

  try {
    if (!email || !password || !communityId) {
      return res.status(400).json({ message: "Email, password, and communityId are required" });
    }

    // Check community exists
    const community = await Community.findOne({ communityId });
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }

    // Check if user exists
    let user = await User.findOne({ email }).populate("community");

    if (user) {
      // User exists -> try login
      if (!user.community || user.community.communityId !== communityId) {
        return res.status(403).json({ message: "User does not belong to this organization" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id);

      const options = {
        httpOnly: true,
        secure: true,
      };

      return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json({
          message: "Login successful",
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          profilePic: user.profilePic,
          community: {
            communityId: user.community.communityId,
            name: user.community.name,
            description: user.community.description,
          },
          accessToken,
          refreshToken,
        });
    } else {
      // User does not exist -> create account
      if (!fullName) {
        return res.status(400).json({ message: "Full name is required for signup" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      user = new User({
        fullName,
        email,
        password: hashedPassword,
        phone,
        role,
        profilePic,
        community: community._id,
      });

      await user.save();

      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();

      user.refreshToken = refreshToken;
      await user.save();

      return res.status(201).json({
        message: "User created and logged in successfully",
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        community: {
          communityId: community.communityId,
          name: community.name,
          description: community.description,
        },
        accessToken,
        refreshToken,
      });
    }
  } catch (error) {
    console.error("CheckSignupOrLogin Error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};