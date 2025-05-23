import { create } from "zustand";
import { authService } from "./authService";
const baseURL =
  import.meta.env.MODE === "development" ? "http://localhost:50136" : "";

export const socketService = create((set, get) => ({
  messages: [],
  users: [],

  getusers: async () => {
    try {
      const token = localStorage.getItem("token");
      const query = await fetch(`${baseURL}/api/users/get-users`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await query.json();
      const users = data.map((user) => ({
        username: user.username,
        image: user.image,
      }));
      set({ users: users });
    } catch (err) {
      console.error(
        "Error:",
        err || err.messgae || err.stack || "Unexpected error."
      );
    }
  },

  getmessages: async (receiver) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) console.error("Token is missing");
      const query = await fetch(
        `${baseURL}/api/messages/get-messages/${receiver}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const messages = await query.json();
      set({ messages: messages });
    } catch (error) {
      console.error(error);
    }
  },

  sendmessage: async (messageData, receiver) => {
    try {
      const formData = new FormData();
      formData.append("message", messageData.message);
      formData.append("image_data", messageData.image_data);
      formData.append("sender", messageData.sender);
      formData.append("receiver", messageData.receiver);
      formData.append("created_at", messageData.created_at);

      const token = localStorage.getItem("token");
      const query = await fetch(
        `${baseURL}/api/messages/send-message/${receiver}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );
      const response = await query.json();
      set({ messages: [...get().messages, response] });
    } catch (error) {
      console.error(error);
    }
  },

  subscribeToMessages: async (receiver) => {
    if (!receiver) return;

    const socket = authService.getState().socket;

    console.log("Socket in subscribeToMessages:", socket);

    if (!socket) {
      console.info("Socket is not connected, re-initializing the socket.");
      const _re_socket = authService.getState().connectSocket;
      _re_socket();
      if(!socket) {
        console.error("Cannot initiate new intance for the socket, something is wrong with the session");
        return;
      }
    } 

    socket.on("newMessage", (msg) => {
      console.log("message", msg);
      get().getmessages(receiver);
      set({ messages: [...get().messages, msg] });
    });
  },

  unsubscribeFromMessages: async () => {
    const socket = authService.getState().socket;
    if (!socket) return;

    socket.off("newMessage");
  },
}));
