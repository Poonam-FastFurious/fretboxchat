import Message from "./Chat.model.js";
import { getReceiverSocketId, io } from "../../lib/socket.js";
import cloudinary from "../../lib/cloudinary.js";
import mongoose from "mongoose";
import Chat from "../Groups/Groupschat.model.js";
// export const getMessages = async (req, res) => {
//   try {
//     const { id: userToChatId } = req.params;
//     const myId = req.user._id;

//     const messages = await Message.find({
//       $or: [
//         { senderId: myId, receiverId: userToChatId },
//         { senderId: userToChatId, receiverId: myId },
//       ],
//     });

//     res.status(200).json(messages);
//   } catch (error) {
//     console.log("Error in getMessages controller: ", error.message);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

export const getMessages = async (req, res) => {
  try {
    const { id: chatOrUserId } = req.params; // Can be User ID (private) or Chat ID (group)
    const myId = req.user._id;

    // Check if it's a group chat
    const chat = await Chat.findById(chatOrUserId);

    let messages;
    if (chat && chat.isGroup) {
      // If it's a group, get all messages where receiverId is the group chat ID
      messages = await Message.find({ receiverId: chatOrUserId }).sort({ createdAt: 1 });
    } else {
      // If it's a private chat, find messages between sender and receiver
      messages = await Message.find({
        $or: [
          { senderId: myId, receiverId: chatOrUserId },
          { senderId: chatOrUserId, receiverId: myId },
        ],
      }).sort({ createdAt: 1 });
    }

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params; // Can be User ID or Chat ID
    const senderId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ error: "Invalid receiver ID" });
    }

    // Check if receiverId belongs to a group chat
    const chat = await Chat.findById(receiverId);
    const isGroupChat = chat && chat.isGroup;

    let imageUrl = null;
    if (req.file) {
      const uploadResponse = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { resource_type: "image" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          }
        ).end(req.file.buffer);
      });

      imageUrl = uploadResponse;
    }

    // Save message
    const newMessage = new Message({
      senderId,
      receiverId, // Can be User ID (private) or Chat ID (group)
      text,
      image: imageUrl,
    });

    await newMessage.save();

    if (isGroupChat) {
      // Notify all group members except sender
      chat.members.forEach((memberId) => {
        if (memberId.toString() !== senderId.toString()) {
          const receiverSocketId = getReceiverSocketId(memberId);
          if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", newMessage);
          }
        }
      });
    } else {
      // Private chat: Notify the receiver
      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", newMessage);
      }
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
// export const sendMessage = async (req, res) => {
//   try {
//     const { text, image } = req.body;
//     const { id: receiverId } = req.params;
//     const senderId = req.user._id;

//     let imageUrl = null;
//     if (req.file) {
//       const uploadResponse = await new Promise((resolve, reject) => {
//         cloudinary.uploader.upload_stream(
//           { resource_type: "image" },
//           (error, result) => {
//             if (error) return reject(error);
//             resolve(result.secure_url);
//           }
//         ).end(req.file.buffer);
//       });

//       imageUrl = uploadResponse;
//     }

//     const newMessage = new Message({
//       senderId,
//       receiverId,
//       text,
//       image: imageUrl,
//     });

//     await newMessage.save();

//     const receiverSocketId = getReceiverSocketId(receiverId);
//     if (receiverSocketId) {
//       io.to(receiverSocketId).emit("newMessage", newMessage);
//     }

//     res.status(201).json(newMessage);
//   } catch (error) {
//     console.log("Error in sendMessage controller: ", error.message);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };
export const sendMessageWithPoll = async (req, res) => {
  try {
    const { text, image, poll } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let pollData = null;
    if (poll) {
      // Poll ke options validate karna
      if (
        !poll.question ||
        !poll.options ||
        !Array.isArray(poll.options) ||
        poll.options.length < 2
      ) {
        return res.status(400).json({
          error: "Poll must have a question and at least two options.",
        });
      }

      // Poll save karne ke liye ek object
      pollData = {
        question: poll.question,
        options: poll.options.map((option) => ({ text: option, votes: 0 })),
      };
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      poll: pollData,
    });

    await newMessage.save();

    // Receiver ka socket ID leke real-time update bhejna
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessageWithPoll", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessageWithPoll controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const deleteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;

    // Find the message by ID
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if the user is the sender of the message
    if (message.senderId.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "You cant delete this   message" });
    }

    // Delete the message
    await Message.findByIdAndDelete(messageId);

    // Notify the receiver about message deletion
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeleted", { messageId });
    }

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.log("Error in deleteMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
