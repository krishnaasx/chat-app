import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? false 
      : ["http://localhost:5000"],
    methods: ["GET", "POST", "PUT", "DELETE"]
  },
});

const userSocketMap = {};

export function receiverSocketId(username) {
  return userSocketMap[username];
}

io.on("connection", (socket) => {
  console.log("A user has connected", socket.id);

  const username = socket.handshake.query.username;
  if (username) userSocketMap[username] = socket.id;

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    console.log("A user has disconnected", socket.id);
    delete userSocketMap[username];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
