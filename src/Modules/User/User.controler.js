import { User } from "./User.model.js";
import bcrypt from "bcryptjs";

import { generateToken } from "../../lib/utils.js";
import Message from "../Chatdata/Chat.model.js";
import cloudinary from "../../lib/cloudinary.js";
import Chat from "../Groups/Groupschat.model.js";

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

export const getUserList = async (req, res) => {
  try {
    const users = await User.find().select("-password"); // Exclude password field
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateUser = async (req, res) => {
  const id = req.user._id; // Get user ID from middleware
  const { fullName, email } = req.body; // Fields to update

  try {
    // Ensure at least one field is provided
    if (!fullName && !email) {
      return res.status(400).json({
        success: false,
        message: "At least one field (fullName or email) is required",
      });
    }

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if email is already in use by another user
    if (email) {
      const emailExists = await User.findOne({ email, _id: { $ne: id } });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email already in use by another account",
        });
      }
    }

    // Update only provided fields
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;

    await user.save();

    // Return success response
    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Error updating user:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// export const signup = async (req, res) => {
//   const { fullName, email, password } = req.body;
//   try {
//     if (!fullName || !email || !password) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     if (password.length < 6) {
//       return res
//         .status(400)
//         .json({ message: "Password must be at least 6 characters" });
//     }

//     const user = await User.findOne({ email });

//     if (user) return res.status(400).json({ message: "Email already exists" });

//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     const newUser = new User({
//       fullName,
//       email,
//       password: hashedPassword,
//     });

//     if (newUser) {
//       // generate jwt token here
//       generateToken(newUser._id, res);
//       await newUser.save();

//       res.status(201).json({
//         _id: newUser._id,
//         fullName: newUser.fullName,
//         email: newUser.email,
//         profilePic: newUser.profilePic,
//       });
//     } else {
//       res.status(400).json({ message: "Invalid user data" });
//     }
//   } catch (error) {
//     console.log("Error in signup controller", error.message);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// };
const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      token,
    });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// export const getUsersForSidebar = async (req, res) => {
//   try {
//     const loggedInUserId = req.user._id;
//     const filteredUsers = await User.find({
//       _id: { $ne: loggedInUserId },
//     }).select("-password");
//     const usersWithMessages = await Promise.all(
//       filteredUsers.map(async (user) => {
//         // Find the latest non-deleted message between logged-in user and this user
//         const latestMessage = await Message.findOne({
//           $or: [
//             { senderId: loggedInUserId, receiverId: user._id },
//             { senderId: user._id, receiverId: loggedInUserId },
//           ],
//           deleted: false, // Ignore deleted messages
//         })
//           .sort({ createdAt: -1 }) // Get the latest message
//           .limit(1);

//         return {
//           ...user.toObject(),
//           latestMessage: latestMessage || null, // Include latest message if found, otherwise null
//         };
//       })
//     );
//     res.status(200).json(usersWithMessages);
//   } catch (error) {
//     console.error("Error in getUsersForSidebar: ", error.message);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

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
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // Fetch the logged-in user details
    const loggedInUser = await User.findById(loggedInUserId);
    if (!loggedInUser) {
      return res.status(404).json({ error: "User not found" });
    }

    let userFilter = {};

    if (loggedInUser.role === "SuperAdmin") {
      // SuperAdmin should see all users under them (Admins + Students)
      userFilter = { superAdmin: loggedInUserId, _id: { $ne: loggedInUserId } };
    } else if (loggedInUser.role === "Admin") {
      // Admin should see only their assigned students
      userFilter = { admin: loggedInUserId, role: "User" };
    } else if (loggedInUser.role === "User") {
      // User should see all users under the same SuperAdmin (except themselves)
      userFilter = {
        superAdmin: loggedInUser.superAdmin, // Fetch all users under the same SuperAdmin
        _id: { $ne: loggedInUserId }, // Exclude the logged-in user from the list
      };
    } else {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Fetch filtered users
    const filteredUsers = await User.find(userFilter)
      .select("-password")
      .populate("admin", "fullName email role") // Include admin details
      .populate("superAdmin", "fullName email role"); // Include superAdmin details

    // Add latest message info
    const usersWithMessages = await Promise.all(
      filteredUsers.map(async (user) => {
        const latestMessage = await Message.findOne({
          $or: [
            { senderId: loggedInUserId, receiverId: user._id },
            { senderId: user._id, receiverId: loggedInUserId },
          ],
          deleted: false,
        })
          .sort({ createdAt: -1 })
          .limit(1);

        return {
          ...user.toObject(),
          latestMessage: latestMessage || null,
        };
      })
    );

    res.status(200).json(usersWithMessages);
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error.message);
    res.status(500).json({ error: "Internal server error" });
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
export const getRecentChatUsers = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // Find all messages where the user is involved, sorted by latest first
    const recentMessages = await Message.find({
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
    }).sort({ createdAt: -1 });

    // Map to store unique chat IDs with latest message
    const chatMap = new Map();

    recentMessages.forEach((message) => {
      const chatId =
        message.senderId.toString() === loggedInUserId.toString()
          ? message.receiverId.toString()
          : message.senderId.toString();

      if (!chatMap.has(chatId)) {
        chatMap.set(chatId, {
          lastMessage: message.text, // Store last message
          lastMessageTime: message.createdAt, // Store last message time
        });
      }
    });

    // Fetch user or group details
    const chatUsers = await Promise.all(
      [...chatMap.keys()].map(async (id) => {
        const user = await User.findById(id).select("fullName profilePic");
        if (user) {
          return {
            _id: user._id,
            fullName: user.fullName,
            profilePic: user.profilePic,
            isGroup: false,
            lastMessage: chatMap.get(id).lastMessage,
            lastMessageTime: chatMap.get(id).lastMessageTime,
          };
        }
        const group = await Chat.findById(id).select("groupName groupImage");
        if (group) {
          return {
            _id: group._id,
            fullName: group.groupName,
            profilePic: group.groupImage,
            isGroup: true,
            lastMessage: chatMap.get(id).lastMessage,
            lastMessageTime: chatMap.get(id).lastMessageTime,
          };
        }
        return null;
      })
    );

    res.status(200).json(chatUsers.filter(Boolean)); // Remove null values
  } catch (error) {
    console.error("Error in getRecentChatUsers:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export { login };
