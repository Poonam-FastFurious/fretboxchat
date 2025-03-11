import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
      {
            chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true }, // Linked to chat
            sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Who sent the message

            content: { type: String, default: null }, // Text message
            media: { type: String, default: null }, // Image/Video URL

            messageType: {
                  type: String,
                  enum: ["text", "image", "video", "poll"],
                  default: "text",
            },

            poll: {
                  question: { type: String, default: null },
                  options: [
                        {
                              optionText: { type: String },
                              votes: { type: Number, default: 0 },
                              votesby: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
                        },
                  ],
            },

            readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users who have read the message

            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
      },
      { timestamps: true }
);


export const Message = mongoose.model("Message", MessageSchema);
