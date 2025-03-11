import jwt from "jsonwebtoken";
import { User } from "../Modules/User/User.model.js";


export const authenticateUser = async (req, res, next) => {
  try {
    // 1️⃣ Get Token from Cookies OR Authorization Header
    const token =
      req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    // 2️⃣ Verify JWT Token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // 3️⃣ Fetch User from Database
    const user = await User.findById(decoded._id).select("-password -refreshToken");
    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    req.user = user; // Attach user to request
    next();
  } catch (error) {
    console.error("JWT Error:", error.message);
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};
