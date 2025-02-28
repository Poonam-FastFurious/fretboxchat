import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.frontendurl,

    credentials: true,
  },
});

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Routes import
import adminrouter from "../src/Modules/Admin/Admin.routes.js";
import userrouter from "../src/Modules/CTHUser/User.routes.js";
import townhallprofile from "../src/Modules/Townhallprofile/Townhallprofile.routes.js";
import Banner from "../src/Modules/Banner/Banner.routes.js";
import privacy from "../src/Modules/PrivacyPolicy/Privacypolicy.routes.js";
import termscondtion from "../src/Modules/TermAndConditions/Termscondition.routes.js";
import blogs from "../src/Modules/Blog/Blog.routes.js";
import Sliders from "../src/Modules/Slider/Slider.routes.js";
import ReturnPolicy from "../src/Modules/ReturnPolicy/ReturnPolicy.routes.js";
import faqs from "../src/Modules/FAQS/Faq.routes.js";
import testimonials from "../src/Modules/Testimonial/Testimonial.routes.js";
import videotestimonial from "../src/Modules/Videotestimonial/Videotestimonial.routes.js";
import happycustomer from "../src/Modules/HappyCustomers/HappyCustomer.routes.js";
import Gallery from "../src/Modules/Gallery/Gallery.routes.js";
import associatemember from "../src/Modules/Associatemember/Associate.routes.js";
import chatRoutes from "../src/Modules/Chats/Chat.routes.js";
import messageRoutes from "../src/Modules/Mesaage/Message.routes.js";
import mediaRoutes from "../src/Modules/Media/Media.routes.js";
import { User } from "./Modules/CTHUser/User.model.js";
import { asyncHandler } from "./utils/asyncHandler.js";
app.use("/api/v1/admin", adminrouter);
app.use("/api/v1/user", userrouter);
app.use("/api/v1/townhalluser", townhallprofile);
app.use("/api/v1/Banner", Banner);
app.use("/api/v1/privacy", privacy);
app.use("/api/v1/terms", termscondtion);
app.use("/api/v1/blog", blogs);
app.use("/api/v1/slider", Sliders);
app.use("/api/v1/Returnpolicy", ReturnPolicy);
app.use("/api/v1/faq", faqs);
app.use("/api/v1/testimonial", testimonials);
app.use("/api/v1/videotestimonial", videotestimonial);
app.use("/api/v1/happycustomer", happycustomer);
app.use("/api/v1/gallery", Gallery);
app.use("/api/v1/associate", associatemember);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/message", messageRoutes);
app.use("/api/v1/media", mediaRoutes);

// Socket.io connection handler
io.on(
  "connection",
  asyncHandler(async (socket) => {
    const userId = socket.handshake.query.userId;
    const updateData = {
      Active: true,
    };
    await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-refreshToken");
    console.log(`A user with ID ${userId} connected`);
    // Handle incoming messages
    socket.on("message", (data) => {
      console.log(`Message received from user ${userId}:`, data);
      if (data.content && data.image) {
        // Agar content me image ka data hai to usko handle karein
        console.log("Image received:", data.image);
      }

      io.emit("message", { ...data, userId });
    });

    // Handle disconnection
    socket.on(
      "disconnect",
      asyncHandler(async () => {
        const updateData = {
          Active: false,
          lastActive: Date.now(),
        };
        await User.findByIdAndUpdate(userId, updateData, {
          new: true,
          runValidators: false,
        });
        console.log("A user disconnected");
      })
    );
  })
);
export { app, server };
