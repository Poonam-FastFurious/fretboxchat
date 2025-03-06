import Chat from "./Groupschat.model.js";

export const createGroupChat = async (req, res) => {
  try {
    const { members, groupName, groupImage } = req.body;

    if (!members || members.length < 2) {
      return res
        .status(400)
        .json({ error: "At least two members required for a group chat" });
    }

    const creatorId = req.user._id;
    const creatorRole = req.user.role; // Fetching creator's role

    if (!members.includes(creatorId)) {
      members.push(creatorId);
    }

    // If creator is Admin, set status to true (Active), otherwise false (Pending)
    const status = creatorRole === "Admin"; // true if Admin, false otherwise

    const newChat = new Chat({
      members,
      isGroup: true,
      groupName,
      groupImage,
      status, // Boolean status
    });

    await newChat.save();
    res.status(201).json(newChat);
  } catch (error) {
    console.log("Error in createGroupChat: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getGroupChats = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // Fetch only groups where logged-in user is a member
    const groups = await Chat.find({
      isGroup: true,
      members: loggedInUserId,
    })
      .populate("members", "fullName email")
      .select(
        "groupName members isGroup groupImage status createdAt updatedAt"
      ); // Add 'status' field

    // Modify response to include fullName as groupName
    const formattedGroups = groups.map((group) => ({
      _id: group._id,
      fullName: group.groupName, // Setting fullName as groupName
      members: group.members,
      isGroup: group.isGroup,
      profilePic: group.groupImage,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      status: group.status, // Ensure status is included
    }));

    res.status(200).json(formattedGroups);
  } catch (error) {
    console.log("Error in getGroupChats: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getGroupById = async (req, res) => {
  try {
    const { groupId } = req.query; // Group ID from request params

    // Find group by ID
    const group = await Chat.findOne({ _id: groupId, isGroup: true })
      .populate("members", "name email") // Fetch only name & email of members
      .select("groupName members"); // Select only necessary fields

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Format response
    const formattedGroup = {
      _id: group._id,
      groupName: group.groupName,
      membersCount: group.members.length, // Count of members
      members: group.members, // Member details (name & email)
    };

    res.status(200).json(formattedGroup);
  } catch (error) {
    console.error("Error in getGroupById:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
