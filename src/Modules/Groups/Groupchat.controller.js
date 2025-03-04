import Chat from "../Groupschat.model";

export const createGroupChat = async (req, res) => {
      try {
            const { members, groupName, groupImage } = req.body;

            if (!members || members.length < 2) {
                  return res.status(400).json({ error: "At least two members required for a group chat" });
            }

            const newChat = new Chat({
                  members,
                  isGroup: true,
                  groupName,
                  groupImage,
            });

            await newChat.save();
            res.status(201).json(newChat);
      } catch (error) {
            console.log("Error in createGroupChat: ", error.message);
            res.status(500).json({ error: "Internal server error" });
      }
};
