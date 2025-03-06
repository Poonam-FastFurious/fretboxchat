import express from "express";
import { protectRoute } from "../../middleware/auth.middleware.js";
import {
  createGroupChat,
  getGroupById,
  getGroupChats,
} from "./Groupchat.controller.js";

const router = express.Router();

router.post("/create-group", protectRoute, createGroupChat);
router.get("/allgroup", protectRoute, getGroupChats);
router.get("/single", protectRoute, getGroupById);

export default router;
