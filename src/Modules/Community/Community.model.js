import mongoose from "mongoose";

const communitySchema = new mongoose.Schema({
  communityId: {
    type: String,
    required: true,
    unique: true, // e.g., "F230041"
  },
  name: {
    type: String,
    required: true, // e.g., "Fretbox UAT"
  },
  description: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
export const Community = mongoose.model("Community", communitySchema);
