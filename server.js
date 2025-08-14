// Install: npm install express socket.io
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + "/public"));

let users = {}; // username → socket.id

io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("register", (username) => {
        users[username] = socket.id;
        socket.username = username;
        console.log(username + " registered");
    });

    socket.on("call-user", (data) => {
        const targetSocketId = users[data.to];
        if (targetSocketId) {
            io.to(targetSocketId).emit("incoming-call", { from: socket.username });
        }
    });

    socket.on("accept-call", (data) => {
        const targetSocketId = users[data.to];
        if (targetSocketId) {
            io.to(targetSocketId).emit("call-accepted", { from: socket.username });
        }
    });

    socket.on("disconnect", () => {
        if (socket.username) {
            delete users[socket.username];
        }
    });
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
