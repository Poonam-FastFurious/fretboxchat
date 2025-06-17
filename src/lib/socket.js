import { Server } from "socket.io";
import http from "http";
import express from "express";
import { Chat } from "../Modules/Chats/Chat.Model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "https://fretbox.brandbell.in",
      "http://localhost:5173",
      "https://admin.binarydots.com",
    ],
  },
});

// used to store online users
const userSocketMap = {}; // {userId: socketId}

export function getReceiverSocketId(userId) {
  console.log("Fetching socket ID for user:", userId);
  console.log("Current userSocketMap:", userSocketMap);
  return userSocketMap[userId] || null; // Ensure null is returned if not found
}
// Socket.io connection
io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  console.log("📥 UserID received in socket:", userId);
  if (userId) {
    userSocketMap[userId] = socket.id;
    console.log(" 🟢 Updated userSocketMap:", userSocketMap); // ✅ Debugging ke liye
  }

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // ===============================
  // Typing Event
  // ===============================
  socket.on("typing", async ({ chatId, senderId }) => {
    try {
      const chat = await Chat.findById(chatId);
      const members = chat?.participants || [];

      members.forEach((userId) => {
        if (userId.toString() !== senderId) {
          const socketId = getReceiverSocketId(userId);
          if (socketId) {
            io.to(socketId).emit("typing", { chatId, senderId });
          }
        }
      });
    } catch (error) {
      console.error("Error in typing event:", error);
    }
  });

  // ===============================
  // Stop Typing Event
  // ===============================
  socket.on("stopTyping", async ({ chatId, senderId }) => {
    try {
      const chat = await Chat.findById(chatId);
      const members = chat?.participants || [];

      members.forEach((userId) => {
        if (userId.toString() !== senderId) {
          const socketId = getReceiverSocketId(userId);
          if (socketId) {
            io.to(socketId).emit("stopTyping", { chatId, senderId });
          }
        }
      });
    } catch (error) {
      console.error("Error in stopTyping event:", error);
    }
  });

  // ===============================
  // Disconnection
  // ===============================
  socket.on("disconnect", () => {
    console.log("🔴 A user disconnected:", socket.id);
    delete userSocketMap[userId];
    console.log("🛑 Updated userSocketMap after disconnect:", userSocketMap);
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
