import express from "express";
import { protectRoute } from "../../middleware/auth.middleware.js";
import multer from "multer";
import {
  deleteMessage,
  getMessages,
  sendMessage,
  sendMessageWithPoll,
  voteOnPoll,
} from "./Chat.controler.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, upload.single("media"), sendMessage);

router.delete("/delete/:id", protectRoute, deleteMessage);

router.post("/pole/:id", protectRoute, sendMessageWithPoll);
router.post("/vote", protectRoute, voteOnPoll);

export default router;
