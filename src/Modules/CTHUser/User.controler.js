import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "./User.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import fs from "fs";
import { uploadOnCloudinary } from "../../utils/Cloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import { upload } from "../../middlewares/FileUpload.middlwares.js";
import dotenv from "dotenv";
import { Chat } from "../Chats/Chat.model.js";
import sendEmail from "../../utils/Sendemail.js";
import { TownhallProfile } from "../Townhallprofile/Townhallprofile.model.js";
import { uploadToS3 } from "../../utils/S3Service.js";

dotenv.config();
const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating tokens:", error);
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
const registerUser = asyncHandler(async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      displayName,
      contactNumber,
      emailAddress,
      linkedinProfile,
      address,
      skills,
      gender,
      AccountStatus,
      honoursAndCertifications,
      IsApproved,
    } = req.body;

    // Validate required fields
    if (
      [firstName, lastName, displayName, contactNumber, emailAddress].some(
        (field) => field?.trim() === ""
      )
    ) {
      throw new ApiError(
        400,
        "First Name, Last Name, Display Name, Contact Number, and Email Address are required"
      );
    }

    // Check if contact number already exists
    const contactExists = await User.findOne({ contactNumber });
    if (contactExists) {
      throw new ApiError(
        409,
        "User with the same contact number already exists"
      );
    }

    // Check if email address already exists
    const emailExists = await User.findOne({ emailAddress });
    if (emailExists) {
      throw new ApiError(
        409,
        "User with the same email address already exists"
      );
    }

    // Create a unique username
    let username = `CTHUSER${firstName}`;
    let userExists = await User.findOne({ username });

    while (userExists) {
      username = `CTHUSER${firstName}${Math.floor(Math.random() * 10000)}`;
      userExists = await User.findOne({ username });
    }

    // Create user object
    const user = await User.create({
      firstName,
      lastName,
      displayName,
      username,
      contactNumber,
      emailAddress,
      linkedinProfile,
      address,
      skills,
      AccountStatus,
      gender,
      honoursAndCertifications,
      IsApproved,
    });

    // Fetch created user without refreshToken fields
    const createdUser = await User.findById(user._id).select("-refreshToken");

    if (!createdUser) {
      throw new ApiError(
        500,
        "Something went wrong while registering the user"
      );
    }

    // Create TownhallProfile for the new user
    const userProfile = await TownhallProfile.create({
      userId: createdUser._id,
      displayName: createdUser.displayName,
      skill: createdUser.skills,
      gender: createdUser.gender,
      email: createdUser.emailAddress,
      linkedinProfile: createdUser.linkedinProfile,
      honoursAndCertifications: createdUser.honoursAndCertifications,
    });

    if (!userProfile) {
      throw new ApiError(
        500,
        "Something went wrong while creating the user profile"
      );
    }

    // Return success response
    return res
      .status(201)
      .json(new ApiResponse(201, createdUser, "User registered successfully"));
  } catch (err) {
    // Handle specific ApiError instances
    if (err instanceof ApiError) {
      return res
        .status(err.statusCode)
        .json({ success: false, message: err.message });
    }

    // Generic server error for unexpected issues
    console.error("Unexpected error:", err);
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
});

const loginUser = async (req, res) => {
  const generateAccessAndRefreshTokens = async (userId) => {
    try {
      const user = await User.findById(userId);
      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();

      user.refreshToken = refreshToken;
      user.LoginTime = new Date();

      await user.save({ validateBeforeSave: false });

      return { accessToken, refreshToken };
    } catch (error) {
      throw new ApiError(
        500,
        "Something went wrong while generating refresh and access token"
      );
    }
  };

  const { contactNumber, emailAddress, OTP } = req.body;

  try {
    // Ensure that contactNumber or emailAddress is provided
    if (!contactNumber && !emailAddress) {
      throw new ApiError(400, "Contact number or email is required");
    }

    // Find the user by contact number or email address
    const user = await User.findOne({
      $or: [{ contactNumber }, { emailAddress }],
    });

    // Check if user exists
    if (!user) {
      throw new ApiError(404, "User does not exist");
    }

    // Check if the user is approved
    if (!user.IsApproved) {
      throw new ApiError(
        400,
        "User does not have permission; please contact Admin"
      );
    }

    // Validate OTP
    const isPasswordValid = await user.isOTPCorrect(OTP);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid user credentials");
    }

    // Generate access and refresh tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );

    // Fetch logged-in user data (excluding refreshToken)
    const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );
    user.LoginTime = Date.now();
    user.Active = true;

    await user.save({ validateBeforeSave: false });

    // Set options for cookies
    const options = {
      httpOnly: true,
      secure: true,
    };

    // Send response with cookies and logged-in user data
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { user: loggedInUser, accessToken, refreshToken },
          "User logged in successfully"
        )
      );
  } catch (error) {
    console.error("Error during login:", error);

    // Handle specific errors
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    }

    // Handle other unexpected errors
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const logoutUser = async (req, res) => {
  try {
    // Assuming you have the user ID available in the request body or query parameters
    const userId = req.body || req.query; // Modify this according to how the user ID is sent in your request

    if (!userId) {
      throw new ApiError(400, "user ID is required");
    }

    // Find the admin by ID
    const user = await User.findById(userId);

    if (!userId) {
      throw new ApiError(404, "user not found");
    }

    // Set login status to false
    user.lastActive = Date.now();
    user.Active = false;
    await user.save({ validateBeforeSave: false });

    // Clear cookies (optional)
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    return res
      .status(200)
      .json({ success: true, message: "user logged out successfully" });
  } catch (error) {
    console.error("Error during logout:", error);

    // Handle specific errors
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    }

    // Handle other unexpected errors
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
const getAllUsers = asyncHandler(async (req, res) => {
  // Step 1: Fetch all users
  const users = await User.find({}).select("-OTP -refreshToken");

  if (!users || users.length === 0) {
    throw new ApiError(404, "No users found");
  }

  // Step 2: Fetch all profiles for the users
  const userIds = users.map((user) => user._id); // Get user IDs
  const profiles = await TownhallProfile.find({ userId: { $in: userIds } }); // Fetch profiles that match user IDs

  // Step 3: Map profiles to users
  const usersWithProfiles = users.map((user) => {
    const userProfile = profiles.find(
      (profile) => profile.userId.toString() === user._id.toString()
    );
    return {
      ...user.toObject(), // Convert user to a plain object
      profile: userProfile || null, // Add profile to user
    };
  });

  // Step 4: Return the users with profiles
  return res
    .status(200)
    .json(
      new ApiResponse(200, usersWithProfiles, "All users fetched successfully")
    );
});

const updateUser = asyncHandler(async (req, res) => {
  const {
    userId, // Ensure userId is in the request body
    firstName,
    lastName,
    username,
    contactNumber,
    emailAddress,
    linkedinProfile,
    address,
    skills,
    AccountStatus,
    academicProjects,
    honoursAndCertifications,
  } = req.body;

  console.log("Received userId:", userId);
  console.log("Is Valid ObjectId:", mongoose.isValidObjectId(userId));
  // Validate user ID
  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  // Fetch the user to ensure they exist
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Prepare the update object
  const updateData = {
    firstName: firstName || user.firstName,
    lastName: lastName || user.lastName,
    username: username || user.username, // Update username
    contactNumber: contactNumber || user.contactNumber,
    emailAddress: emailAddress || user.emailAddress,
    linkedinProfile: linkedinProfile || user.linkedinProfile,
    address: address || user.address,
    skills: skills || user.skills,
    academicProjects: academicProjects || user.academicProjects,
    honoursAndCertifications:
      honoursAndCertifications || user.honoursAndCertifications,
    AccountStatus: AccountStatus || user.AccountStatus,
  };

  // Update the user
  const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-refreshToken");

  if (!updatedUser) {
    throw new ApiError(500, "Something went wrong while updating the user");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "User updated successfully"));
});
const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.query; // Expecting userId as a query parameter

  // Validate user ID
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid or missing user ID");
  }

  // Find and delete the user
  const deletedUser = await User.findByIdAndDelete(userId);
  if (!deletedUser) {
    throw new ApiError(404, "User not found");
  }
  await TownhallProfile.deleteOne({
    userId: new mongoose.Types.ObjectId(userId),
  }); // Convert userId to ObjectId
  return res
    .status(200)
    .json(new ApiResponse(200, null, "User deleted successfully"));
});
const getCurrentUser = asyncHandler(async (req, res) => {
  // Extract userId from the request (from the query parameter or body)
  const userId = req.params.userId || req.body.userId || req.query.userId;

  // Validate userId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid User ID");
  }

  // Fetch user details by userId
  const user = await User.findById(userId).select("-password -refreshToken"); // Exclude sensitive fields

  // Handle case when user is not found
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User details retrieved successfully"));
});

const uploadProfilePhoto = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.body.userId || req.query.userId;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  if (!req.files || !req.files.profilePhoto) {
    throw new ApiError(400, "Profile photo is required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const imageLocalPath = req.files?.profilePhoto[0]?.path;

  if (!imageLocalPath) {
    throw new ApiError(400, "Image files are required");
  }

  const uploadedImage = await uploadOnCloudinary(imageLocalPath);

  if (!uploadedImage) {
    throw new ApiError(400, "Failed to upload image");
  }

  // Delete old profile photo if it exists
  if (user.profilePhoto) {
    const oldPublicId = user.profilePhoto.split("/").pop().split(".")[0];

    try {
      await cloudinary.uploader.destroy(oldPublicId);
      console.log("Old profile photo deleted successfully from Cloudinary");
    } catch (error) {
      console.error("Error deleting old profile photo from Cloudinary:", error);
    }
  }
  // Save the new profile photo

  // Update the user's profile photo path in the database
  const updatedData = { profilePhoto: uploadedImage.url };
  const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
    new: true,
    runValidators: true,
  }).select("-refreshToken");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { profilePhoto: updatedUser.profilePhoto },
        "Profile photo uploaded successfully"
      )
    );
});
const removeProfilePhoto = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.body.userId || req.query.userId;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  if (!req.files || !req.files.profilePhoto) {
    throw new ApiError(400, "Profile photo not found");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const imageLocalPath = req.files?.profilePhoto[0]?.path;

  if (!imageLocalPath) {
    throw new ApiError(400, "Image files are required");
  }

  // Delete old profile photo if it exists
  if (user.profilePhoto && user.profilePhoto != "") {
    const oldPublicId = user.profilePhoto.split("/").pop().split(".")[0];
    try {
      await cloudinary.uploader.destroy(oldPublicId);
      console.log("Old profile photo deleted successfully from Cloudinary");
    } catch (error) {
      console.error("Error deleting old profile photo from Cloudinary:", error);
    }
  }
  const updatedData = { profilePhoto: "" };
  await User.findByIdAndUpdate(userId, updatedData, {
    new: true,
    runValidators: true,
  }).select("-refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, "Profile photo Deleted successfully"));
});
const getStatus = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.body.userId || req.query.userId;
  const user = await User.findById(userId);
  if (user.Active) {
    return res.status(200).json(new ApiResponse(200, { Status: "Online" }, ""));
  } else {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { Status: "Offline", lastActive: user.lastActive },
          ""
        )
      );
  }
});
const updateUserPrivacy = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.body.userId || req.query.userId;
  const { LastSeen, ReadReceipt, Status, profilePhotoVisibility } = req.body;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const updateData = {
    LastSeen: LastSeen ?? user.LastSeen,
    ReadReceipt: ReadReceipt ?? user.ReadReceipt,
    Status: Status ?? user.Status,
    profilePhotoVisibility:
      profilePhotoVisibility ?? user.profilePhotoVisibility,
  };

  const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-refreshToken");

  if (!updatedUser) {
    throw new ApiError(500, "Something went wrong while updating the user");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "User privacy settings updated successfully"));
});
const approveUser = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.body.userId || req.query.userId;

  // Validate userId
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  // Find the user
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Set IsApproved to true
  user.IsApproved = true;
  await user.save({ validateBeforeSave: false });
  await sendEmail({
    email: user.emailAddress,
    subject: "User Approval",
    message:
      "Your account have been approved by admin you can sign in now using mobile or email",
  });
  // Automatically add the user to the group
  const groupChat = await Chat.findOne({
    chatName: "HALL 1 (General)",
    isGroupChat: true,
  });

  if (groupChat) {
    const added = await Chat.findByIdAndUpdate(
      groupChat._id,
      {
        $addToSet: { users: user._id }, // $addToSet ensures the user is added only if not already in the group
      },
      {
        new: true,
      }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    if (!added) {
      throw new ApiError(404, "Failed to add user to group");
    }

    console.log(`User ${user.username} added to HALL 1 (General) group.`);
  } else {
    throw new ApiError(404, "Group chat not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isApproved: user.IsApproved },
        "User approval status updated successfully, email sent."
      )
    );
});
const requestOTP = async (req, res) => {
  try {
    const { emailAddress } = req.body;

    if (!emailAddress) {
      throw new ApiError(400, "Email address is required");
    }

    const user = await User.findOne({ emailAddress });

    if (!user) {
      throw new ApiError(404, "Email does not exist. Please sign up");
    }

    const otp = generateOTP();

    user.OTP = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes
    await user.save();

    // Send OTP via email
    const emailOptions = {
      email: emailAddress,
      subject: "Your OTP Code",
      message: `Your otp for Complaince Townhall login is: ${otp}. It is valid for 10 minutes.`,
    };
    console.log("Plain OTP Sent to User:", otp); // Debugging log
    await sendEmail(emailOptions);

    return res
      .status(200)
      .json(new ApiResponse(200, null, "OTP sent to your email"));
  } catch (error) {
    console.error("Error during OTP request:", error);

    // Handle specific errors
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    }

    // Handle other unexpected errors
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
export {
  registerUser,
  loginUser,
  getAllUsers,
  updateUser,
  deleteUser,
  getCurrentUser,
  uploadProfilePhoto,
  getStatus,
  logoutUser,
  updateUserPrivacy,
  upload,
  removeProfilePhoto,
  approveUser,
  requestOTP,
};
