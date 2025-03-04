import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./src/lib/db.js";
import cookieParser from "cookie-parser";
import cors from "cors";
dotenv.config();
import { app, server } from "./src/lib/socket.js";

const PORT = process.env.PORT;


app.use(express.json());
app.use(cookieParser());
app.use(express.json({ limit: "250mb" })); // Increase limit for JSON requests
app.use(express.urlencoded({ limit: "2500mb", extended: true })); // Increase limit for form data

app.use(
      cors({
            origin: "https://fretbox.brandbell.in",
            credentials: true,
      })
);


import userRoutes from "./src/Modules/User/User.routes.js"
import messageRoutes from "./src/Modules/Chatdata/Chat.routes.js"



app.use("/api/v1/user", userRoutes);
app.use("/api/v1/chat_message", messageRoutes);

server.listen(PORT, () => {
      console.log("serveris listen on port" + PORT);
      connectDB();
})