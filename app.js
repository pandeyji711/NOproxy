const express = require("express");
const path = require("path");
const http = require("http");
const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const SECRET = "super-secret-key"; // Replace with .env in prod
const createdRooms = new Set();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/room/:roomName", (req, res) => {
  res.render("room", { roomName: req.params.roomName });
});
let adminCodeState = {}; // { roomName: { code, generatedAt } }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-room", (roomName) => {
    if (createdRooms.has(roomName)) {
      socket.emit("error-message", "Room already exists.");
    } else {
      createdRooms.add(roomName);
      socket.join(roomName);
      const token = jwt.sign({ room: roomName, admin: true }, SECRET, {
        expiresIn: "1h",
      });
      socket.emit("room-created", { roomName, adminToken: token });
    }
  });

  socket.on("join-room", (roomName) => {
    if (!createdRooms.has(roomName)) {
      socket.emit("error-message", "Room does not exist.");
    } else {
      socket.join(roomName);
      socket.emit("room-joined", roomName);

      // Ask admin for current code
      socket
        .to(roomName)
        .emit("request-latest-code", { newSocketId: socket.id });
    }
  });

  socket.on("secret-code", ({ roomName, code, token }) => {
    try {
      const payload = jwt.verify(token, SECRET);
      if (payload.room === roomName && payload.admin) {
        const generatedAt = Date.now();
        adminCodeState[roomName] = { code, generatedAt };

        // Broadcast to room
        io.to(roomName).emit("secret-code", { code, generatedAt });
      }
    } catch (err) {
      socket.emit("error-message", "Token verification failed.");
    }
  });

  // When admin receives a request to share latest code
  socket.on("send-latest-code", ({ roomName, code, generatedAt, to }) => {
    io.to(to).emit("secret-code", { code, generatedAt });
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
