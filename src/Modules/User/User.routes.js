import express from "express";
import multer from "multer";
import {
  signup,
  login,
  logout,
  checkAuth,
  getUsersForSidebar,
  updateProfile,
  getUserById,
  getUserList,
  updateUser,
  getRecentChatUsers,
} from "./User.controler.js";

import { protectRoute } from "../../middleware/auth.middleware.js";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/signup", signup);
router.get("/alluser", getUserList);
router.post("/login", login);
router.post("/logout", logout);
router.get("/check", protectRoute, checkAuth);
router.get("/singleuser/:id", getUserById);
router.get("/chatlist", protectRoute, getUsersForSidebar);
router.get("/recent", protectRoute, getRecentChatUsers);
router.patch("/update_user", protectRoute, updateUser);
router.patch(
  "/update-profile",
  protectRoute,
  upload.single("profilePic"),
  updateProfile
);
export default router;
