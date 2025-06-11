import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./src/lib/db.js";
import cookieParser from "cookie-parser";
import cors from "cors";
dotenv.config();
import { app, server } from "./src/lib/socket.js";

const PORT = process.env.PORT || 5002;

app.use(express.json());
app.use(cookieParser());
app.use(express.json({ limit: "250mb" })); // Increase limit for JSON requests
app.use(express.urlencoded({ limit: "2500mb", extended: true })); // Increase limit for form data

app.use(
  cors({
    origin: [
      "https://fretbox.brandbell.in",
      "http://localhost:5173",
      "https://admin.binarydots.com",
    ],
    credentials: true,
  })
);

import userRoutes from "./src/Modules/User/User.routes.js";
import chatRoutes from "./src/Modules/Chats/Chat.routes.js";
import messageRoutes from "./src/Modules/Message/Message.routes.js";
import communitiesRoutes from "./src/Modules/Community/Community.routes.js";

app.use("/api/v1/user", userRoutes);
app.use("/api/v1/chats", chatRoutes);
app.use("/api/v1/message", messageRoutes);
app.use("/api/v1/community", communitiesRoutes);

server.listen(PORT, "0.0.0.0", () => {
  console.log("server is listen on port " + PORT);
  connectDB();
});
