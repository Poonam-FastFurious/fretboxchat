import express from "express";
import { authenticateUser } from "../../Middleware/auth.middleware.js";
import { deleteMessage, getMessages, sendMessage, sendPoll, voteOnPoll } from "./Message.controler.js";
import multer from "multer";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });
router.post("/send/:chatId", authenticateUser, upload.single("file"), sendMessage);
router.post("/send-poll/:chatId", authenticateUser, sendPoll);
router.get("/:chatId", authenticateUser, getMessages);
router.post("/vote", authenticateUser, voteOnPoll);
router.delete("/delete/:messageId", authenticateUser, deleteMessage);

export default router;