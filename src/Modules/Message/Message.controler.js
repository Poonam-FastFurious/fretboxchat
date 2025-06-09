import cloudinary from "../../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../../lib/socket.js";
import { Chat } from "../Chats/Chat.Model.js";
import { Message } from "./Message.model.js";

export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = 20, search = "" } = req.query; // Default pagination values

    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    const chat = await Chat.findById(chatId).populate("participants", "_id");

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Check if user is a participant in the chat
    if (
      !chat.participants.some(
        (user) => user._id.toString() === userId.toString()
      )
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Create search filter
    let searchFilter = { chat: chatId };
    if (search) {
      searchFilter.content = { $regex: search, $options: "i" }; // Case-insensitive search
    }

    // Pagination settings
    const messages = await Message.find(searchFilter)
      .populate("sender", "name email profilePic")
      .sort({ createdAt: -1 }) // Latest messages first
      .skip((page - 1) * limit) // Skip previous pages
      .limit(Number(limit)); // Limit the number of messages

    // Total count of messages for frontend pagination
    const totalMessages = await Message.countDocuments(searchFilter);

    // Mark messages as read for the user
    if (chat.unreadMessages.has(userId.toString())) {
      chat.unreadMessages.set(userId.toString(), 0);
      await chat.save();
    }

    res.status(200).json({
      messages,
      totalMessages,
      currentPage: Number(page),
      totalPages: Math.ceil(totalMessages / limit),
    });
  } catch (error) {
    console.log("Error in getMessages controller:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// export const sendMessage = async (req, res) => {
//   try {
//     const { content, messageType } = req.body;
//     const { chatId } = req.params;
//     const senderId = req.user._id;
//     let mediaUrl = null;

//     console.log("📨 Sending message:", { chatId, senderId, messageType });

//     // ✅ Handle Image/Video Upload
//     if (req.file) {
//       console.log("🖼 Uploading file to Cloudinary...");

//       mediaUrl = await new Promise((resolve, reject) => {
//         cloudinary.uploader
//           .upload_stream(
//             { resource_type: messageType === "video" ? "video" : "image" },
//             (error, result) => {
//               if (error) {
//                 console.log("❌ Cloudinary upload error:", error);
//                 return reject(error);
//               }
//               resolve(result.secure_url);
//             }
//           )
//           .end(req.file.buffer);
//       });

//       console.log("✅ Uploaded File URL:", mediaUrl);
//     }

//     // ✅ Find Chat
//     const chat = await Chat.findById(chatId);
//     if (!chat) {
//       return res.status(404).json({ error: "Chat not found" });
//     }

//     // ✅ Find Receiver
//     const receiverId = chat.participants.find(
//       (user) => user.toString() !== senderId.toString()
//     );
//     if (!receiverId) {
//       return res.status(400).json({ error: "Invalid chat participants" });
//     }

//     console.log("🎯 Receiver User ID:", receiverId);

//     // ✅ Create Message
//     const newMessage = new Message({
//       sender: senderId,
//       chat: chatId,
//       content: messageType === "text" ? content : null,
//       media: mediaUrl,
//       messageType,
//     });

//     await newMessage.save();
//     const savedMessage = await newMessage.populate(
//       "sender",
//       "name email profilePic"
//     );
//     chat.latestMessage =
//       messageType === "text" ? savedMessage.content : mediaUrl;

//     if (receiverId) {
//       chat.unreadMessages.set(
//         receiverId.toString(),
//         (chat.unreadMessages.get(receiverId.toString()) || 0) + 1
//       );
//     }

//     await chat.save();
//     // ✅ SOCKET.IO - Send message in real-time
//     const receiverSocketId = getReceiverSocketId(receiverId);
//     if (receiverSocketId) {
//       console.log("📡 Sending message to receiver via Socket.IO...");
//       io.to(receiverSocketId).emit("newMessage", savedMessage);
//     } else {
//       console.log("📥 User is offline, message stored in DB");
//     }

//     res.status(201).json(savedMessage);
//   } catch (error) {
//     console.log("❌ Error in sendMessage:", error.message);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };
export const sendMessage = async (req, res) => {
  try {
    const { content, messageType } = req.body;
    const { chatId } = req.params;
    const senderId = req.user?._id;

    if (!chatId) {
      return res
        .status(400)
        .json({ message: "Missing required route param: chatId" });
    }

    if (!senderId) {
      return res.status(401).json({
        message:
          "Unauthorized: req.user._id is missing. Check your auth middleware.",
      });
    }

    if (!messageType) {
      return res
        .status(400)
        .json({ message: "Missing required field: messageType in body" });
    }

    if (messageType === "text" && !content) {
      return res
        .status(400)
        .json({ message: "Content is required for text messages" });
    }

    let mediaUrl = null;

    // ⬆️ Upload file to Cloudinary if file present
    if (req.file) {
      try {
        mediaUrl = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              { resource_type: messageType === "video" ? "video" : "image" },
              (error, result) => {
                if (error) {
                  console.error("❌ Cloudinary upload error:", error);
                  return reject("Cloudinary upload failed: " + error.message);
                }
                resolve(result.secure_url);
              }
            )
            .end(req.file.buffer);
        });
      } catch (cloudError) {
        return res.status(500).json({
          message: "Failed to upload media to Cloudinary",
          error: cloudError,
        });
      }
    }

    // 🔍 Find Chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res
        .status(404)
        .json({ message: `Chat not found with ID: ${chatId}` });
    }

    // 🔍 Validate sender is part of chat
    const isParticipant = chat.participants.some(
      (id) => id.toString() === senderId.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({
        message: "Access denied: Sender is not a participant in the chat",
      });
    }

    // 🔁 Find Receiver
    const receiverId = chat.participants.find(
      (user) => user.toString() !== senderId.toString()
    );
    if (!receiverId) {
      return res
        .status(400)
        .json({ message: "Invalid chat: No receiver found" });
    }

    // ✉️ Create message
    const newMessage = new Message({
      sender: senderId,
      chat: chatId,
      content: messageType === "text" ? content : null,
      media: mediaUrl,
      messageType,
    });

    await newMessage.save();

    const savedMessage = await newMessage.populate(
      "sender",
      "name email profilePic"
    );

    // 🔁 Update chat
    chat.latestMessage =
      messageType === "text" ? savedMessage.content : mediaUrl;

    // 🟡 Mark unread count
    if (receiverId) {
      chat.unreadMessages.set(
        receiverId.toString(),
        (chat.unreadMessages.get(receiverId.toString()) || 0) + 1
      );
    }

    await chat.save();

    // 📡 Emit via Socket.IO
    chat.participants.forEach((participantId) => {
      if (participantId.toString() !== senderId.toString()) {
        const receiverSocketId = getReceiverSocketId(participantId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("newMessage", savedMessage);
        } else {
          console.log(`ℹ️ User ${participantId} is offline.`);
        }
      }
    });

    res.status(201).json(savedMessage);
  } catch (error) {
    console.error("❌ Error in sendMessage controller:", error);
    res.status(500).json({
      message: "Internal Server Error: Unable to send message",
      error: error.message,
      suggestion: "Ensure chatId is valid and Cloudinary is reachable",
    });
  }
};

export const sendPoll = async (req, res) => {
  try {
    const { question, options } = req.body;
    const { chatId } = req.params;
    const senderId = req.user?._id;

    console.log("📊 Creating poll:", { chatId, senderId, question });

    // 🛑 Validate Inputs
    if (!chatId) {
      return res
        .status(400)
        .json({ message: "Missing required route param: chatId" });
    }

    if (!senderId) {
      return res.status(401).json({
        message:
          "Unauthorized: req.user._id is missing. Check authentication middleware.",
      });
    }

    if (
      !question ||
      !options ||
      !Array.isArray(options) ||
      options.length < 2
    ) {
      return res.status(400).json({
        message: "Poll must have a valid question and at least two options.",
        suggestion:
          "Ensure body has: { question: string, options: string[] (min 2) }",
      });
    }

    // 🔍 Find Chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res
        .status(404)
        .json({ message: `Chat not found with ID: ${chatId}` });
    }

    // ✅ Verify Sender is part of Chat
    const isParticipant = chat.participants.some(
      (user) => user.toString() === senderId.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({
        message: "Access denied: You are not a participant of this chat.",
      });
    }

    // 🔍 Find Receiver
    const receiverId = chat.participants.find(
      (user) => user.toString() !== senderId.toString()
    );
    if (!receiverId) {
      return res.status(400).json({
        message: "Invalid chat: No valid receiver found.",
        suggestion: "Ensure chat has at least 2 participants.",
      });
    }

    // ✅ Create Poll Message
    const newPoll = new Message({
      sender: senderId,
      chat: chatId,
      messageType: "poll",
      poll: {
        question,
        options: options.map((option) => ({
          optionText: option,
          votes: 0,
          votesby: [],
        })),
      },
    });

    await newPoll.save();

    const savedPoll = await newPoll.populate("sender", "name email profilePic");

    // 📡 Emit Poll
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      console.log("📡 Sending poll to receiver via Socket.IO...");
      io.to(receiverSocketId).emit("newMessage", savedPoll);
    } else {
      console.log("📥 Receiver offline, poll stored in DB");
    }

    res.status(201).json(savedPoll);
  } catch (error) {
    console.error("❌ Error in sendPoll controller:", error);
    res.status(500).json({
      message: "Internal Server Error: Unable to send poll",
      error: error.message,
      suggestion: "Check chatId validity, request structure, and DB connection",
    });
  }
};

export const voteOnPoll = async (req, res) => {
  try {
    const { messageId, optionIndex } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message || !message.poll || !message.poll.options) {
      return res.status(404).json({ error: "Poll not found or invalid." });
    }

    if (optionIndex < 0 || optionIndex >= message.poll.options.length) {
      return res.status(400).json({ error: "Invalid option index." });
    }

    let previousOptionIndex = -1;

    // ✅ Pehle vote check karna
    message.poll.options.forEach((option, index) => {
      if (option.votesby.includes(userId)) {
        previousOptionIndex = index;
      }
    });

    // ✅ Pehle ka vote remove karna
    if (previousOptionIndex !== -1) {
      message.poll.options[previousOptionIndex].votes =
        Number(message.poll.options[previousOptionIndex].votes) - 1;
      message.poll.options[previousOptionIndex].votesby = message.poll.options[
        previousOptionIndex
      ].votesby.filter((id) => id.toString() !== userId.toString());
    }

    // ✅ Ensure votes is always a number
    message.poll.options[optionIndex].votes =
      Number(message.poll.options[optionIndex].votes) + 1;
    message.poll.options[optionIndex].votesby.push(userId);

    await message.save();

    io.emit("pollUpdated", { messageId, poll: message.poll });

    res.status(200).json({ message: "Vote updated", poll: message.poll });
  } catch (error) {
    console.log("Error in voteOnPoll controller:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    console.log("🗑 Deleting message:", { messageId, userId });

    // ✅ Find Message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // ✅ Authorization Check (Only sender can delete)
    if (message.sender.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "Unauthorized to delete this message" });
    }

    // ✅ Delete Message
    await Message.findByIdAndDelete(messageId);

    // ✅ SOCKET.IO - Notify Receiver
    const chat = await Chat.findById(message.chat);
    const receiverId = chat.participants.find(
      (user) => user.toString() !== userId.toString()
    );
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      console.log("📡 Notifying receiver via Socket.IO...");
      io.to(receiverSocketId).emit("messageDeleted", { messageId });
    }

    console.log("✅ Message deleted successfully.");
    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.log("❌ Error in deleteMessage:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    console.log("📖 Marking messages as read for:", { chatId, userId });

    // ✅ Find Chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // ✅ Reset Unread Count
    if (chat.unreadMessages.has(userId.toString())) {
      chat.unreadMessages.set(userId.toString(), 0);
      await chat.save();
    }

    res.status(200).json({ message: "Messages marked as read" });
  } catch (error) {
    console.log("❌ Error in markMessagesAsRead:", error.message);
    res.status(500).json({ error: error.message });
  }
};
