import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema(
  {
    isGroup: { type: Boolean, default: false }, // false = One-to-One, true = Group Chat

    // One-to-One Chat
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ], // Stores sender & receiver for one-to-one, all users for group chat

    groupName: { type: String, default: null }, // Only for group chats
    groupImage: { type: String, default: null }, // Only for group chats
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    }, // Group admin (only for groups)

    status: { type: String, enum: ["active", "inactive"], default: "inactive" }, // Chat status

    latestMessage: {
      type: String,
    },

    unreadMessages: {
      type: Map,
      of: Number, // { userId: count } - Unread messages per user
      default: {},
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Chat = mongoose.model("Chat", ChatSchema);
