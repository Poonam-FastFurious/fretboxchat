import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { server } from "./app.js"; // Import the server from app.js
import { initializeAdmin } from "./Modules/Admin/Admin.controler.js";
// import { createCTHMainGroup } from "./Modules/Chats/Chat.controler.js";

dotenv.config({
  path: "./.env",
});
const PORT = process.env.PORT || Math.floor(Math.random() * 1000) + 3000;
connectDB()
  .then(() => {
    console.log("mongoose connected successfully ");
    initializeAdmin();
    server.listen(PORT || 8000, () => {
      console.log(`⚙️ Server is running at port : ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
  });
