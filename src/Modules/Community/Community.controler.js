import { Community } from "./Community.model.js";

export const createCommunity = async (req, res) => {
  try {
    const { communityId, name, description } = req.body;

    // Missing fields
    if (!communityId || !name) {
      return res.status(400).json({
        error: true,
        message:
          "Missing required fields: 'communityId' and 'name' are required.",
        hint: "Make sure both fields are sent in the request body.",
      });
    }

    // Invalid data types
    if (typeof communityId !== "string" || typeof name !== "string") {
      return res.status(400).json({
        error: true,
        message:
          "Invalid data types: 'communityId' and 'name' must be strings.",
        hint: "Check if you're sending a number or object instead of text.",
      });
    }

    // Check duplicate communityId
    const exists = await Community.findOne({ communityId });
    if (exists) {
      return res.status(409).json({
        error: true,
        message: `Community ID '${communityId}' already exists.`,
        hint: "Try a unique communityId like 'COMM2025', 'F1234', etc.",
      });
    }

    // Create
    const newCommunity = await Community.create({
      communityId,
      name,
      description,
    });

    return res.status(201).json({
      error: false,
      message: "Community created successfully.",
      data: newCommunity,
    });
  } catch (err) {
    // MongoDB Duplicate error (failsafe)
    if (err.code === 11000) {
      return res.status(409).json({
        error: true,
        message: "Duplicate entry detected.",
        details: err.keyValue,
      });
    }

    // Show actual error instead of "Internal Server Error"
    return res.status(500).json({
      error: true,
      message: "Something went wrong.",
      actual: err.message,
    });
  }
};

export const bulkCreateCommunities = async (req, res) => {
  try {
    const communities = req.body;

    if (!Array.isArray(communities) || communities.length === 0) {
      return res.status(400).json({
        error: true,
        message: "Request body must be a non-empty array of communities.",
        hint: "Send data as an array of { communityId, name, description }.",
      });
    }

    const errors = [];
    const toInsert = [];

    for (let i = 0; i < communities.length; i++) {
      const { communityId, name, description } = communities[i];

      // Validation
      if (!communityId || !name) {
        errors.push({
          index: i,
          message: "Missing required fields 'communityId' or 'name'.",
        });
        continue;
      }

      if (typeof communityId !== "string" || typeof name !== "string") {
        errors.push({
          index: i,
          message: "'communityId' and 'name' must be strings.",
        });
        continue;
      }

      // Check DB for duplicates
      const exists = await Community.findOne({ communityId });
      if (exists) {
        errors.push({
          index: i,
          message: `Community ID '${communityId}' already exists.`,
        });
        continue;
      }

      toInsert.push({
        communityId: communityId.trim(),
        name: name.trim(),
        description: description?.trim() || `Welcome to ${name.trim()}`,
      });
    }

    if (toInsert.length === 0) {
      return res.status(409).json({
        error: true,
        message: "No valid communities to insert.",
        errors,
      });
    }

    const created = await Community.insertMany(toInsert);

    return res.status(201).json({
      error: false,
      message: `${created.length} communities created successfully.`,
      data: created,
      skipped: errors,
    });
  } catch (err) {
    return res.status(500).json({
      error: true,
      message: "Something went wrong during bulk community creation.",
      actual: err.message,
    });
  }
};
export const getAllCommunities = async (req, res) => {
  try {
    const communities = await Community.find().sort({ name: 1 });
    return res.status(200).json({
      error: false,
      message: "Communities retrieved successfully.",
      data: communities,
    });
  } catch (err) {
    return res.status(500).json({
      error: true,
      message: "Failed to retrieve communities.",
      actual: err.message,
    });
  }
};