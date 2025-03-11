import express from "express";
import { accessChat, addUserToGroup, createGroupChat, deleteChat, fetchChats, getChatProfile, removeUserFromGroup, renameGroupChat } from "./Chat.controler.js";
import { authenticateUser } from "../../Middleware/auth.middleware.js";



const router = express.Router();


router.post("/access", authenticateUser, accessChat); // Create/Get a chat

// ✅ Fetch all chats for the logged-in user
router.get("/", authenticateUser, fetchChats);

// ✅ Group Chat Routes
router.post("/group", authenticateUser, createGroupChat); // Create group
router.patch("/group/rename", authenticateUser, renameGroupChat); // Rename group
router.put("/add", authenticateUser, addUserToGroup); // Add user to group
router.put("/remove", authenticateUser, removeUserFromGroup); // Remove user from group

// ✅ Delete Chat
router.delete("/:chatId", authenticateUser, deleteChat);
router.get("/:chatId", getChatProfile);




export default router;