import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["https://fretbox.brandbell.in", "http://localhost:5173"],
  },
});



// used to store online users
const userSocketMap = {}; // {userId: socketId}

export function getReceiverSocketId(userId) {
  console.log("Fetching socket ID for user:", userId);
  console.log("Current userSocketMap:", userSocketMap);
  return userSocketMap[userId] || null; // Ensure null is returned if not found
}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  console.log("📥 UserID received in socket:", userId);
  if (userId) {
    userSocketMap[userId] = socket.id;
    console.log("Updated userSocketMap:", userSocketMap); // ✅ Debugging ke liye
  }

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    console.log("🔴 A user disconnected:", socket.id);
    delete userSocketMap[userId];
    console.log("🛑 Updated userSocketMap after disconnect:", userSocketMap);
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
