import express from "express";
import {
  bulkCreateCommunities,
  createCommunity,
  getAllCommunities,
} from "./Community.controler.js";

const router = express.Router();

router.post("/add", createCommunity);
router.post("/alladd", bulkCreateCommunities);
router.get("/", getAllCommunities);

export default router;
