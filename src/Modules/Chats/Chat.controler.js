import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Chat } from "./Chat.model.js";
import { User } from "../CTHUser/User.model.js";
const accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    console.log("User ID Params Not sent in the request!");
    return res.sendStatus(400);
  }
  let isChat = await Chat.find({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } },
      { users: { $elemMatch: { $eq: userId } } },
    ],
  })
    .populate("users", "-password")
    .populate("latestMessage");

  isChat = await User.populate(isChat, {
    path: "latestMessage.sender",
    select: "name avatar email",
  });

  if (isChat.length > 0) {
    res.send(isChat[0]);
  } else {
    let chatData = {
      chatName: "Direct",
      isGroupChat: false,
      users: [req.user._id, userId],
    };

    try {
      const createdChat = await Chat.create(chatData);
      const FullChat = await Chat.findOne({ _id: createdChat._id }).populate(
        "users",
        "-password"
      );
      res.status(200).send(FullChat);
    } catch (error) {
      console.log(error);
    }
  }
});
const createCTHMainGroup = async () => {
  try {
    const groupExists = await Chat.findOne({
      chatName: "HALL 1 (General)",
      isGroupChat: true,
    });
    if (!groupExists) {
      const users = await User.find();
      if (users.length === 0) return;

      const groupChat = await Chat.create({
        chatName: "HALL 1 (General)",
        users: users.map((user) => user._id),
        isGroupChat: true,
        groupAdmin: "67a59e6f83c9ebb8a2e7ba53",
      });

      console.log(
        "HALL 1 (General) group created successfully with all users."
      );
    }
  } catch (error) {
    console.error("Error creating CTHMain group:", error.message);
  }
};
const fetchChats = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id; // Logged-in user ID

    const chats = await Chat.find({ users: { $elemMatch: { $eq: userId } } })
      .populate("users", "-password") // Populate users except password
      .populate("groupAdmin", "-password") // Populate groupAdmin details
      .populate({
        path: "latestMessage",
        populate: { path: "sender", select: "firstName lastName displayName" }, // Populate sender details in latestMessage
      })
      .sort({ updatedAt: -1 }); // Sort chats by recent activity

    // Add `otherParticipants` field for each chat
    const modifiedChats = chats.map((chat) => {
      let otherParticipants;

      if (chat.isGroupChat) {
        // Group chat => Sab users except req.user
        otherParticipants = chat.users
          .filter((user) => user._id.toString() !== userId.toString())
          .map((user) => ({
            _id: user._id,
            name: user.firstName + " " + user.lastName,
            profilePhoto: user.profilePhoto || "",
          }));
      } else {
        // Direct chat => Sirf doosre user ki ID & name
        otherParticipants = chat.users
          .filter((user) => user._id.toString() !== userId.toString())
          .map((user) => ({
            _id: user._id,
            name: user.firstName + " " + user.lastName,
            profilePhoto: user.profilePhoto || "",
          }))[0]; // Direct chat me sirf ek hi banda hoga
      }

      return { ...chat._doc, otherParticipants };
    });

    res.status(200).json(modifiedChats);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// const fetchChats = asyncHandler(async (req, res) => {
//   try {
//     Chat.find({ users: { $elemMatch: { $eq: req.user } } })
//       .populate("users", "-password")
//       .populate("groupAdmin", "-password")
//       .populate("latestMessage")
//       .sort({ updatedAt: -1 })
//       .then(async (results) => {
//         results = await User.populate(results, {
//           path: "latestMessage.sender",
//           select: "name avatar email",
//         });
//         res.status(200).send(results);
//       });
//   } catch (error) {
//     res.status(400);
//     throw new Error(error.message);
//   }
// });

const fetchSingleChat = asyncHandler(async (req, res) => {
  const { chatId } = req.query;

  try {
    const chat = await Chat.findOne({
      _id: chatId,
      users: { $elemMatch: { $eq: req.user } },
    })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("latestMessage");

    if (!chat) {
      res.status(404);
      throw new Error("Chat not found or you don't have access to this chat");
    }

    const populatedChat = await User.populate(chat, {
      path: "latestMessage.sender",
      select: "name avatar email",
    });

    res.status(200).send(populatedChat);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const createGroupChat = asyncHandler(async (req, res) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).send({ message: "Please Fill all the feilds" });
  }

  var users = JSON.parse(req.body.users);

  if (users.length < 2) {
    return res
      .status(400)
      .send("More than 2 users are required to form a group chat");
  }

  users.push(req.user);

  try {
    for (const userId of users) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(400).send({ message: "User not found" });
      }
      if (user.Status === "private") {
        return res
          .status(400)
          .send({ message: `User ${user.username}'s account is private` });
      }
    }
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.user,
    });

    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json(fullGroupChat);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const renameGroup = asyncHandler(async (req, res) => {
  const { chatId, chatName } = req.body;

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      chatName: chatName,
    },
    {
      new: true,
    }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!updatedChat) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(updatedChat);
  }
});

const addToGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;
  if (!chatId || !userId) {
    return res
      .status(400)
      .send({ message: "Chat ID and User ID are required" });
  }
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).send({ message: "User not found" });
  }
  if (user.AccountStatus === "Private") {
    return res
      .status(400)
      .send({ message: `User ${user.username} account is private` });
  }
  // check if the requester is admin
  const added = await Chat.findByIdAndUpdate(
    chatId,
    {
      $push: { users: userId },
    },
    {
      new: true,
    }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!added) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(added);
  }
});

const removeFromGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  // check if the requester is admin

  const removed = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull: { users: userId },
    },
    {
      new: true,
    }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!removed) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(removed);
  }
});
const getAllGroupChats = asyncHandler(async (req, res) => {
  try {
    // Fetch all group chats
    const groupChats = await Chat.find({ isGroupChat: true })
      .populate("users", "-password") // Populate users, excluding passwords
      .populate("groupAdmin", "-password") // Populate group admin, excluding passwords
      .sort({ updatedAt: -1 }); // Sort by most recent update

    // Respond with all group chats
    res.status(200).json(groupChats);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});
const getGroupInfo = asyncHandler(async (req, res) => {
  try {
    const { groupId } = req.query; // Extract group ID from request parameters

    // Fetch the specific group chat using the group ID
    const groupChat = await Chat.findOne({ _id: groupId, isGroupChat: true })
      .populate("users", "-password") // Populate users, excluding passwords
      .populate("groupAdmin", "-password"); // Populate group admin, excluding passwords

    // Check if the group exists
    if (!groupChat) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Get the total number of members in the group
    const totalMembers = groupChat.users.length;

    // Prepare the response
    const groupInfo = {
      groupName: groupChat.chatName,
      totalMembers,
      admin: groupChat.groupAdmin,
      users: groupChat.users,
    };

    // Respond with group information
    res.status(200).json(groupInfo);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

export {
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
  fetchSingleChat,
  createCTHMainGroup,
  getAllGroupChats,
  getGroupInfo,
};
