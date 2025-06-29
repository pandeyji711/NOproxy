const express = require("express");
const path = require("path");
const http = require("http");
const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const SECRET = "supersecretkey";
const createdRooms = new Set();
const adminCodeState = {}; // { roomName: { code, generatedAt } }

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.render("index"));

app.get("/room/:roomName", (req, res) => {
  const roomName = req.params.roomName;
  if (!createdRooms.has(roomName)) return res.redirect("/");
  res.render("room", { roomName });
});

io.on("connection", (socket) => {
  socket.on("create-room", (roomName) => {
    if (createdRooms.has(roomName)) {
      socket.emit("error-message", "Room already exists");
    } else {
      createdRooms.add(roomName);
      socket.join(roomName);
      const token = jwt.sign({ room: roomName, admin: true }, SECRET, {
        expiresIn: "1h",
      });
      socket.emit("room-created", { roomName, adminToken: token });
    }
  });

  socket.on("join-room", async (roomName) => {
    if (!createdRooms.has(roomName)) {
      socket.emit("error-message", "Room does not exist");
    } else {
      socket.join(roomName);
      // socket.emit("room-joined", roomName);
      // ✅ Request latest secret code from admin
      socket
        .to(roomName)
        .emit("request-latest-code", { newSocketId: socket.id });

      // ✅ Emit only for participants (skip admin's own socket)
      try {
        const roomSockets = await io.in(roomName).fetchSockets();

        const adminSocket = roomSockets.find(
          (s) => s.handshake.auth?.admin === true
        );

        // Skip if the joining socket is admin themselves
        if (adminSocket && socket.id !== adminSocket.id) {
          adminSocket.emit("new-participant", {
            id: socket.id,
            joinedAt: new Date().toLocaleTimeString(),
          });
        }
      } catch (err) {
        console.error("Error finding admin socket:", err);
      }

      // Request latest secret
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
        io.to(roomName).emit("secret-code", { code, generatedAt });
      }
    } catch (e) {
      socket.emit("error-message", "Token verification failed");
    }
  });

  socket.on("send-latest-code", ({ roomName, code, generatedAt, to }) => {
    io.to(to).emit("secret-code", { code, generatedAt });
  });
});

server.listen(3000, () =>
  console.log("✅ Server running at http://localhost:3000")
);
