import { Router } from "express";
import { verifyJWT } from "../../middlewares/auth.middlwares.js";
import {
  allMessages,
  sendMessage,
  deleteMessage,
} from "./Message.controler.js";
import { upload } from "../../middlewares/FileUpload.middlwares.js";

const router = Router();

router.route("/").post(
  verifyJWT,
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "documents", maxCount: 10 },
  ]),
  sendMessage
);
router.route("/:chatId").get(verifyJWT, allMessages);
router.route("/delete").delete(verifyJWT, deleteMessage);
// router.route("/readon").post(verifyJWT, readOn);
// router.route("/deliverdon").post(verifyJWT, deliveredOn);
// router.route("/pinmessage").patch(pinMessage);
//testData for read on deliverd on
// {
//   "messageIds": ["66b76f7c8ae365838590fd8b", "66b76f7c8ae365838590fd85", "66b76f2f8ae365838590fd7e"]
// }

export default router;
