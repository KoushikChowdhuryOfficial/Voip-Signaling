// Simple WebRTC signaling + static frontend
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const PORT = process.env.PORT || 10000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// serve frontend
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.send("ok"));

/*
users = {
  "koushik": { id: "<socketId>" },
  "rohit":   { id: "<socketId>" }
}
*/
const users = {};

io.on("connection", (socket) => {
  console.log("🔌 connected:", socket.id);

  // 1) register username
  socket.on("register", (username, ack) => {
    if (!username) return ack?.({ ok: false, error: "No username" });
    // if already used, kick old one
    if (users[username]?.id && users[username].id !== socket.id) {
      io.to(users[username].id).emit("force-logout");
    }
    users[username] = { id: socket.id };
    socket.data.username = username;
    console.log("👤 registered:", username);
    ack?.({ ok: true, id: socket.id });
    io.emit("online-list", Object.keys(users));
  });

  // 2) make a call request by target username
  socket.on("call-user", ({ to, from }) => {
    const target = users[to]?.id;
    if (!target) return socket.emit("call-error", { message: "User not online" });
    io.to(target).emit("incoming-call", { from });
  });

  // 3) callee accepts or rejects (simple accept path)
  socket.on("accept-call", ({ to, from }) => {
    const caller = users[to]?.id;
    if (caller) io.to(caller).emit("call-accepted", { from });
  });
  socket.on("reject-call", ({ to, from }) => {
    const caller = users[to]?.id;
    if (caller) io.to(caller).emit("call-rejected", { from });
  });

  // 4) WebRTC signaling (offer/answer/candidates) sent by username
  socket.on("webrtc-offer", ({ to, offer, from }) => {
    const target = users[to]?.id;
    if (target) io.to(target).emit("webrtc-offer", { from, offer });
  });
  socket.on("webrtc-answer", ({ to, answer, from }) => {
    const target = users[to]?.id;
    if (target) io.to(target).emit("webrtc-answer", { from, answer });
  });
  socket.on("webrtc-ice-candidate", ({ to, candidate, from }) => {
    const target = users[to]?.id;
    if (target) io.to(target).emit("webrtc-ice-candidate", { from, candidate });
  });

  // 5) end call
  socket.on("end-call", ({ to, from }) => {
    const target = users[to]?.id;
    if (target) io.to(target).emit("end-call", { from });
  });

  socket.on("disconnect", () => {
    const u = socket.data.username;
    if (u && users[u]?.id === socket.id) {
      delete users[u];
      io.emit("online-list", Object.keys(users));
    }
    console.log("🔌 disconnected:", socket.id);
  });
});

server.listen(PORT, () => console.log(`✅ Server on :${PORT}`));
