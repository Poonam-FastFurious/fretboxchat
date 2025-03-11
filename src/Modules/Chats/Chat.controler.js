import mongoose from "mongoose";
import { Chat } from "./Chat.Model.js";


// Create or get a one-to-one chat
export const accessChat = async (req, res) => {
      try {
            const { receiverId } = req.body; // Receiver user ID
            const senderId = req.user._id; // Logged-in user (sender)

            if (!receiverId) {
                  return res.status(400).json({ message: "ReceiverId is required" });
            }

            let chat = await Chat.findOne({
                  isGroup: false,
                  participants: { $all: [senderId, receiverId] },
            })
                  .populate("participants", "fullName profilePic") // ✅ Populate user details
                  .populate({
                        path: "latestMessage",
                        populate: { path: "sender", select: "fullName profilePic" }, // ✅ Populate sender details in latest message
                  });

            // 👇 **If chat doesn't exist, create a new one & populate**
            if (!chat) {
                  const newChat = await Chat.create({
                        participants: [senderId, receiverId],
                        isGroup: false,
                        status: "active",
                  });

                  // ✅ Populate newly created chat
                  chat = await Chat.findById(newChat._id).populate("participants", "fullName profilePic");
            }

            res.status(200).json(chat);
      } catch (error) {
            res.status(500).json({ message: error.message });
      }
};


// Fetch all chats for the logged-in user (sender)
export const fetchChats = async (req, res) => {
      try {
            const senderId = req.user._id;

            const chats = await Chat.find({
                  participants: senderId,
            })
                  .populate({
                        path: "participants",
                        select: "-password",
                        match: { _id: { $ne: senderId } }, // Exclude senderId
                  })
                  .populate("latestMessage")
                  .sort({ updatedAt: -1 });

            res.status(200).json(chats);
      } catch (error) {
            res.status(500).json({ message: error.message });
      }
};

export const getChatProfile = async (req, res) => {
      try {
            const { chatId } = req.params;

            // Validate if chatId is a valid MongoDB ObjectId
            if (!mongoose.Types.ObjectId.isValid(chatId)) {
                  return res.status(400).json({ message: "Invalid chatId" });
            }

            // Find the chat and populate participants & latestMessage
            const chat = await Chat.findById(chatId)
                  .populate("participants", "-password")  // Get participant details (excluding passwords)
                  .populate("latestMessage")
                  .populate("groupAdmin", "-password");  // If it's a group, populate the admin too

            if (!chat) {
                  return res.status(404).json({ message: "Chat not found" });
            }

            res.status(200).json(chat);
      } catch (error) {
            res.status(500).json({ message: error.message });
      }
};

// Create a group chat
export const createGroupChat = async (req, res) => {
      try {
            const { name, users } = req.body; // Users should be an array of user IDs
            const senderId = req.user._id;

            if (!users || users.length < 2) {
                  return res.status(400).json({ message: "At least two users required for a group chat" });
            }

            const groupChat = await Chat.create({
                  isGroup: true,
                  participants: [...users, senderId],
                  groupName: name,
                  groupAdmin: senderId,
                  status: "active",
            });

            await groupChat.populate("participants", "-password");
            await groupChat.populate("groupAdmin", "-password");

            res.status(201).json(groupChat);
      } catch (error) {
            res.status(500).json({ message: error.message });
      }
};

// Rename a group chat
export const renameGroupChat = async (req, res) => {
      try {
            const { chatId, name } = req.body;
            const chat = await Chat.findByIdAndUpdate(
                  chatId,
                  { groupName: name },
                  { new: true }
            ).populate("participants", "-password");

            if (!chat) {
                  return res.status(404).json({ message: "Chat not found" });
            }

            res.status(200).json(chat);
      } catch (error) {
            res.status(500).json({ message: error.message });
      }
};

// Add user to a group
export const addUserToGroup = async (req, res) => {
      try {
            const { chatId, userId } = req.body;

            const chat = await Chat.findByIdAndUpdate(
                  chatId,
                  { $addToSet: { participants: userId } },
                  { new: true }
            ).populate("participants", "-password");

            if (!chat) {
                  return res.status(404).json({ message: "Chat not found" });
            }

            res.status(200).json(chat);
      } catch (error) {
            res.status(500).json({ message: error.message });
      }
};

// Remove user from a group
export const removeUserFromGroup = async (req, res) => {
      try {
            const { chatId, userId } = req.body;

            const chat = await Chat.findByIdAndUpdate(
                  chatId,
                  { $pull: { participants: userId } },
                  { new: true }
            ).populate("participants", "-password");

            if (!chat) {
                  return res.status(404).json({ message: "Chat not found" });
            }

            res.status(200).json(chat);
      } catch (error) {
            res.status(500).json({ message: error.message });
      }
};

// Delete a chat
export const deleteChat = async (req, res) => {
      try {
            const { chatId } = req.params;

            await Chat.findByIdAndDelete(chatId);
            res.status(200).json({ message: "Chat deleted successfully" });
      } catch (error) {
            res.status(500).json({ message: error.message });
      }
};
