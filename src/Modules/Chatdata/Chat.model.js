import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    poll: {
      question: String,
      options: [{ text: String, votes: Number }],
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message", // Reference to the original message
      default: null,
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
