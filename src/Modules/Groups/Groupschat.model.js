import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
      {
            members: [
                  {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User",
                  },
            ],
            isGroup: {
                  type: Boolean,
                  default: false, // false = private chat, true = group chat
            },
            groupName: {
                  type: String, // Only for groups
                  default: null,
            },
            groupImage: {
                  type: String, // Optional group image
                  default: null,
            },
      },
      { timestamps: true }
);

const Chat = mongoose.model("Chat", chatSchema);
export default Chat;
