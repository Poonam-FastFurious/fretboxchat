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

export const sendMessage = async (req, res) => {
  try {
    const { text, replyTo } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ error: "Invalid receiver ID" });
    }

    const chat = await Chat.findById(receiverId);
    const isGroupChat = chat && chat.isGroup;

    let mediaUrl = null;
    let mediaType = null; // "image" or "video"

    if (req.file) {
      const fileMimeType = req.file.mimetype;
      const resourceType = fileMimeType.startsWith("video") ? "video" : "image";
      mediaType = resourceType;

      const uploadResponse = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ resource_type: resourceType }, (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          })
          .end(req.file.buffer);
      });

      mediaUrl = uploadResponse;
    }

    // Save message
    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: mediaType === "image" ? mediaUrl : null,
      video: mediaType === "video" ? mediaUrl : null,
      replyTo: replyTo || null,
    });

    await newMessage.save();

    if (replyTo) {
      await newMessage.populate("replyTo");
    }

    if (isGroupChat) {
      chat.members.forEach((memberId) => {
        if (memberId.toString() !== senderId.toString()) {
          const receiverSocketId = getReceiverSocketId(memberId);
          if (receiverSocketId) {
            io.to(receiverSocketId).emit("newGroupMessage", newMessage);
          }
        }
      });
    } else {
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


export const getMessages = async (req, res) => {
  try {
    const { id: chatOrUserId } = req.params; // Can be User ID (private) or Chat ID (group)
    const myId = req.user._id;

    // Convert chatOrUserId to ObjectId if it's valid
    const chatOrUserObjectId = mongoose.Types.ObjectId.isValid(chatOrUserId)
      ? new mongoose.Types.ObjectId(chatOrUserId)
      : null;

    if (!chatOrUserObjectId) {
      return res.status(400).json({ error: "Invalid chat or user ID" });
    }

    // Check if it's a group chat
    const chat = await Chat.findById(chatOrUserObjectId);

    let messages;
    if (chat && chat.isGroup) {
      // If it's a group, get all messages where receiverId is the group chat ID
      messages = await Message.find({ receiverId: chatOrUserObjectId }).sort({
        createdAt: 1,
      });
    } else {
      // If it's a private chat, find messages between sender and receiver
      messages = await Message.find({
        $or: [
          {
            senderId: new mongoose.Types.ObjectId(myId),
            receiverId: chatOrUserObjectId,
          },
          {
            senderId: chatOrUserObjectId,
            receiverId: new mongoose.Types.ObjectId(myId),
          },
        ],
      }).sort({ createdAt: 1 });
    }

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
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
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let pollData = null;
    if (poll) {
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

    // ✅ Group check karein
    const chat = await Chat.findById(receiverId);
    const isGroupChat = chat && chat.isGroup;

    if (isGroupChat) {
      // ✅ Group ke sabhi members ko notify karein
      chat.members.forEach((memberId) => {
        if (memberId.toString() !== senderId.toString()) {
          const receiverSocketId = getReceiverSocketId(memberId);
          if (receiverSocketId) {
            io.to(receiverSocketId).emit("newGroupMessage", newMessage);
          }
        }
      });
    } else {
      // ✅ Private chat ke liye normal emit karein
      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessageWithPoll", newMessage);
      }
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
      return res.status(403).json({ error: "You cant delete this   message" });
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

export const voteOnPoll = async (req, res) => {
  try {
    const { messageId, optionIndex } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message || !message.poll) {
      return res.status(404).json({ error: "Poll not found." });
    }

    if (optionIndex < 0 || optionIndex >= message.poll.options.length) {
      return res.status(400).json({ error: "Invalid option index." });
    }

    let previousOptionIndex = -1;

    // ✅ Pehle se diya gaya vote check karna
    message.poll.options.forEach((option, index) => {
      if (option.votedBy.includes(userId)) {
        previousOptionIndex = index;
      }
    });

    // ✅ Pehle ka vote remove karna
    if (previousOptionIndex !== -1) {
      message.poll.options[previousOptionIndex].votes -= 1;
      message.poll.options[previousOptionIndex].votedBy = message.poll.options[
        previousOptionIndex
      ].votedBy.filter((id) => id.toString() !== userId.toString());
    }

    // ✅ Naye option pe vote increment karein
    message.poll.options[optionIndex].votes += 1;
    message.poll.options[optionIndex].votedBy.push(userId);

    await message.save();

    // ✅ Group check karein
    const chat = await Chat.findById(message.receiverId);
    const isGroupChat = chat && chat.isGroup;

    if (isGroupChat) {
      // ✅ Group ke sabhi members ko update bhejna
      chat.members.forEach((memberId) => {
        const memberSocketId = getReceiverSocketId(memberId);
        if (memberSocketId) {
          io.to(memberSocketId).emit("pollUpdated", {
            messageId,
            poll: message.poll,
          });
        }
      });
    } else {
      // ✅ Private chat ke liye sirf sender aur receiver ko notify karein
      const senderSocketId = getReceiverSocketId(message.senderId);
      const receiverSocketId = getReceiverSocketId(message.receiverId);

      if (senderSocketId) {
        io.to(senderSocketId).emit("pollUpdated", {
          messageId,
          poll: message.poll,
        });
      }

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("pollUpdated", {
          messageId,
          poll: message.poll,
        });
      }
    }

    res.status(200).json({ message: "Vote updated", poll: message.poll });
  } catch (error) {
    console.log("Error in voteOnPoll controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
