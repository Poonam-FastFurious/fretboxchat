import { asyncHandler } from "../../utils/asyncHandler.js";
import { Message } from "./Message.model.js";
import { User } from "../CTHUser/User.model.js";
import { Chat } from "../Chats/Chat.model.js";
import { Media } from "../Media/Media.model.js";
import { uploadOnCloudinary } from "../../utils/Cloudinary.js";
import { upload } from "../../middlewares/FileUpload.middlwares.js"; // Adjust the import path as necessary
import { ApiError } from "../../utils/ApiError.js";

const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId, replyTo } = req.body;
  const files = req.files;
  let mediaIds = [];
  let finalChatId = chatId; // Default chatId from request body

  if (replyTo) {
    const repliedMessage = await Message.findById(replyTo);
    if (!repliedMessage) {
      return res.status(400).json({ message: "Replied message not found" });
    }
    finalChatId = repliedMessage.chat; // Use chatId from replied message
  }

  if (!content && (!files?.images || !files?.documents) && !finalChatId) {
    console.log("Bad Request! Invalid Data passed!");
    return res.sendStatus(400);
  }

  if (files?.images) {
    for (const file of files.images) {
      const uploadedImage = await uploadOnCloudinary(file.path);
      if (!uploadedImage) {
        throw new ApiError(400, "Failed to upload image");
      }
      const media = new Media({
        chat: finalChatId,
        sender: req.user._id,
        fileType: "image",
        localPath: file.path,
        filePath: uploadedImage.url,
        originalName: file.originalname,
      });
      await media.save();
      mediaIds.push(media._id);
    }
  }

  if (files?.documents) {
    for (const file of files.documents) {
      const uploadedDocument = await uploadOnCloudinary(file.path);
      if (!uploadedDocument) {
        throw new ApiError(400, "Failed to upload document");
      }
      const media = new Media({
        chat: finalChatId,
        sender: req.user._id,
        fileType: "document",
        localPath: file.path,
        filePath: uploadedDocument.url,
        originalName: file.originalname,
      });
      await media.save();
      mediaIds.push(media._id);
    }
  }

  const newMessage = {
    sender: req.user._id,
    content: content,
    chat: finalChatId, // Ensure chatId is correct
    media: mediaIds,
    sentOn: Date.now(),
  };

  if (replyTo) {
    newMessage.replyTo = replyTo; // Store replied message reference
  }

  try {
    let message = await Message.create(newMessage);

    message = await message.populate("sender", "name avatar");
    message = await message.populate("chat");
    message = await message.populate("replyTo", "content sender"); // Populate replied message

    message = await User.populate(message, {
      path: "chat.users",
      select: "name avatar email",
    });

    await Chat.findByIdAndUpdate(finalChatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    console.log(error);
    res.status(500);
    throw new Error(error.message);
  }
});

// const sendMessage = asyncHandler(async (req, res) => {
//   const { content, chatId } = req.body;
//   const files = req.files;
//   let mediaIds = [];

//   if (!content && (!files.images || !files.documents) && !chatId) {
//     console.log("Bad Request! Invalid Data passed!");
//     return res.sendStatus(400);
//   }

//   // Handle image file uploads
//   if (files && files.images) {
//     for (const file of files.images) {
//       // Upload image to S3
//       const uploadedImage = await uploadToS3(file.buffer, file.originalname);

//       if (!uploadedImage) {
//         throw new ApiError(400, "Failed to upload image to S3");
//       }

//       const media = new Media({
//         chat: chatId,
//         sender: req.user._id,
//         fileType: "image",
//         localPath: file.path,
//         filePath: uploadedImage.Location, // URL from S3 upload
//         originalName: file.originalname,
//       });

//       await media.save();
//       mediaIds.push(media._id);
//     }
//   }

//   // Handle document file uploads
//   if (files && files.documents) {
//     for (const file of files.documents) {
//       // Upload document to S3
//       const uploadedDocument = await uploadToS3(file.buffer, file.originalname);

//       if (!uploadedDocument) {
//         throw new ApiError(400, "Failed to upload document to S3");
//       }

//       const media = new Media({
//         chat: chatId,
//         sender: req.user._id,
//         fileType: "document",
//         localPath: file.path,
//         filePath: uploadedDocument.Location, // URL from S3 upload
//         originalName: file.originalname,
//       });

//       await media.save();
//       mediaIds.push(media._id);
//     }
//   }

//   const newMessage = {
//     sender: req.user._id,
//     content: content,
//     chat: chatId,
//     media: mediaIds,
//     sentOn: Date.now(),
//   };

//   try {
//     let message = await Message.create(newMessage);

//     message = await message.populate("sender", "name avatar");
//     message = await message.populate("chat");
//     message = await User.populate(message, {
//       path: "chat.users",
//       select: "name avatar email",
//     });

//     await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

//     res.json(message);
//   } catch (error) {
//     console.log(error);
//     res.status(500);
//     throw new Error(error.message);
//   }
// });

const allMessages = asyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "firstName profilePhoto email")
      .populate("chat")
      .populate("media");
    res.status(200).json(messages);
  } catch (error) {
    console.log(error);
    res.status(500);
    throw new Error(error.message);
  }
});
const deliveredOn = asyncHandler(async (req, res) => {
  const messageIds = req.body.messageIds;
  try {
    const Data = {
      deliveredOn: Date.now(),
    };
    const updatedMessages = await Promise.all(
      messageIds.map(async (messageId) => {
        return await Message.findByIdAndUpdate(messageId, Data, {
          new: true,
          runValidators: false,
        });
      })
    );
    res.status(200).json(updatedMessages);
  } catch (error) {
    console.log(error);
    res.status(500);
    throw new Error(error.message);
  }
});
const readOn = asyncHandler(async (req, res) => {
  const messageIds = req.body.messageIds; // Expecting an array of message IDs
  try {
    const Data = {
      readOn: Date.now(),
    };

    // Update each message in parallel using Promise.all
    const updatedMessages = await Promise.all(
      messageIds.map(async (messageId) => {
        return await Message.findByIdAndUpdate(messageId, Data, {
          new: true,
          runValidators: false,
        });
      })
    );

    res.status(200).json(updatedMessages);
  } catch (error) {
    console.log(error);
    res.status(500);
    throw new Error(error.message);
  }
});

const pinMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.query;

  // Check if the message exists
  const message = await Message.findById(messageId).populate("chat");
  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  // Toggle the isPinned status
  message.isPinned = !message.isPinned;
  await message.save();

  res.json({
    success: true,
    message: "Message pinned status updated",
    isPinned: message.isPinned,
    chatId: message.chat._id, // Send the chat ID back in the response
  });
});
const deleteMessage = asyncHandler(async (req, res) => {
  try {
    const message = await Message.findById(req.query.messageId);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Ensure only the sender can delete the message
    if (message.sender.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this message" });
    }

    await message.deleteOne();
    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500);
    throw new Error(error.message);
  }
});

export {
  sendMessage,
  allMessages,
  upload,
  readOn,
  deliveredOn,
  pinMessage,
  deleteMessage,
};
