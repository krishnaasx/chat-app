import db from "../config/db.config.js";
import imageType from "image-type";
import { getReceiverSocketId, io } from "../socket/socket.js";

export const sendMessages = async (req, res) => {
  try {
    const {
      username: sender,
      params: { receiver },
      body: { message },
      file,
    } = req;

    if (!sender || !receiver) {
      return res
        .status(400)
        .json({ error: "Sender and receiver are required" });
    }
    if (!message && !file) {
      return res
        .status(400)
        .json({ error: "Either message or file must be provided" });
    }

    await db.query("BEGIN");
    const conversationQuery = await db.query(
      "INSERT INTO conversation(sender, receiver, message) VALUES ($1, $2, $3) RETURNING *",
      [sender, receiver, message || null]
    );

    const { created_at, message_id: messageId } = conversationQuery.rows[0];
    let image = null;
    let imagetype = null;
    let base64Image = null;

    if (file) {
      image = file.buffer;
      imagetype = file.mimetype;
      const attachmentQuery = await db.query(
        "INSERT INTO attachments(message_id, image_data, image_type) VALUES ($1, $2, $3) RETURNING *",
        [messageId, image, imagetype]
      );
      image = attachmentQuery.rows[0].image_data;
      const type = imageType(image)?.mime || "image/jpeg";
      const temp = `data:${type};base64,${image.toString("base64")}`;
      base64Image = temp;
    }

    await db.query("COMMIT");
    const socketId = getReceiverSocketId(receiver);
    console.log("socket id: ", socketId);
    if (socketId) {
      const msg = conversationQuery.rows[0].message;
      io.to(socketId).emit("newMessage", {
        msg,
        base64Image,
        sender,
        receiver,
        created_at,
      });
      console.log(
        "Message sent successfully from the socket's server to :",
        receiver
      );
    }

    return res.status(200).json({
      sender,
      receiver,
      message,
      image_data: base64Image,
      created_at,
    });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Send message error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to send message",
    });
  }
};

export const getMessages = async (req, res) => {
  try {
    const sender = req.username;
    const receiver = req.params.user;

    const query = await db.query(
      `
      SELECT 
        c.message, 
        a.image_data, 
        c.sender, 
        c.receiver, 
        c.created_at 
      FROM conversation c 
      LEFT JOIN attachments a ON c.message_id = a.message_id 
      WHERE (c.sender = $1 AND c.receiver = $2) 
         OR (c.sender = $2 AND c.receiver = $1) 
      ORDER BY c.created_at
    `,
      [sender, receiver]
    );

    const rows = query.rows;

    const messagesWithBase64 = rows.map((row) => {
      if (!row.image_data) {
        return {
          message: row.message,
          image_data: null,
          sender: row.sender,
          receiver: row.receiver,
          created_at: row.created_at,
        };
      }

      const type = imageType(row.image_data)?.mime || "image/jpeg";
      const base64Image = `data:${type};base64,${row.image_data.toString(
        "base64"
      )}`;
      return {
        message: row.message,
        image_data: base64Image,
        sender: row.sender,
        receiver: row.receiver,
        created_at: row.created_at,
      };
    });

    return res.status(200).json(messagesWithBase64);
  } catch (err) {
    console.error("Get messages error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve messages",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
