const express = require("express");
const path = require("path");
const http = require("http");
const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");
const ExcelJS = require("exceljs");
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const SECRET = "supersecretkey";
const createdRooms = new Set();
const adminCodeState = {}; // { roomName: { code, generatedAt } }
const adminSockets = new Map(); // NEW: { roomName => socket.id }
const validEntryKeys = new Map();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => res.render("index"));
app.get("/room/:roomName", (req, res) => {
  const roomName = req.params.roomName;
  if (!createdRooms.has(roomName)) return res.redirect("/");
  const time = parseInt(req.query.time) || 3;
  res.render("room", { roomName, time });
});

app.get("/form/:roomName", (req, res) => {
  const roomName = req.params.roomName;
  res.render("form", { roomName });
});

app.get("/success", (req, res) => {
  res.render("success");
});

// Socket.IO
io.on("connection", (socket) => {
  const { admin } = socket.handshake.auth || {};
  if (admin === true && socket.handshake.query?.room) {
    const roomName = socket.handshake.query.room;
    adminSockets.set(roomName, socket.id);
    // console.log("✅ Registered new admin socket:", socket.id, "for", roomName);
  }
  // Admin creates room
  socket.on("create-room", (roomName) => {
    if (createdRooms.has(roomName)) {
      socket.emit("error-message", "Room already exists");
    } else {
      createdRooms.add(roomName);
      socket.join(roomName);
      // adminSockets.set(roomName, socket.id); // 🆕 Track admin socket ID

      const token = jwt.sign({ room: roomName, admin: true }, SECRET, {
        expiresIn: "1h",
      });

      socket.emit("room-created", { roomName, adminToken: token });
    }
  });

  // Participant attempts to join room
  socket.on("join-room", async (roomName) => {
    if (!createdRooms.has(roomName)) {
      socket.emit("error-message", "Room does not exist");
      return;
    }

    socket.join(roomName);

    // ✅ Request latest code from admin
    socket.to(roomName).emit("request-latest-code", {
      newSocketId: socket.id,
    });

    // ✅ Notify admin (only if this socket is NOT admin)
    try {
      const roomSockets = await io.in(roomName).fetchSockets();
      const adminSocket = roomSockets.find(
        (s) => s.handshake.auth?.admin === true
      );

      if (adminSocket && socket.id !== adminSocket.id) {
        adminSocket.emit("new-participant", {
          id: socket.id,
          joinedAt: new Date().toLocaleTimeString(),
        });
      }
    } catch (err) {
      console.error("Error notifying admin:", err);
    }
  });

  // Admin emits rotating secret code
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

  // Admin sends latest code to newly joined socket
  socket.on("send-latest-code", ({ roomName, code, generatedAt, to }) => {
    io.to(to).emit("secret-code", { code, generatedAt });
  });

  // ✅ New: Verify scanned QR code
  socket.on("verify-secret", ({ roomName, code }) => {
    const entry = adminCodeState[roomName];
    if (entry && entry.code === code) {
      socket.emit("verified", { success: true });
    } else {
      socket.emit("verified", { success: false });
    }
  });

  // ✅ Participant submits details via form
  socket.on(
    "participant-details",
    async ({ roomName, name, roll, admission, entryKey, selfie }) => {
      const et = entryKey;
      // console.log(et);
      // for (const [key, value] of validEntryKeys.entries()) {
      //   console.log(`${key}: [${[...value]}]`);
      // }
      // console.log(validEntryKeys.get(roomName).has(entryKey));
      const isValid =
        validEntryKeys.has(roomName) &&
        validEntryKeys.get(roomName).has(entryKey);

      if (!isValid) {
        socket.emit("error-message", "❌ Invalid or expired entry key");
        return;
      }

      try {
        const roomSockets = await io.in(roomName).fetchSockets();
        const adminSocket = roomSockets.find(
          (s) => s.handshake.auth?.admin === true
        );

        if (adminSocket) {
          // ✅ Send to admin only
          adminSocket.emit("new-participant", {
            name,
            roll,
            admission,
            entryKey,
            selfie,
          });

          // ✅ Confirm entry to this participant only
          socket.emit("entry-confirmed");

          // Optional log
          // console.log(`✅ Entry confirmed for: ${socket.id}`);
        } else {
          socket.emit("error-message", "Admin not available in room");
        }

        // 🧼 Remove key after use
        // validEntryKeys.get(roomName).delete(entryKey);
      } catch (err) {
        console.error("❌ Error during entry submission:", err);
        socket.emit("error-message", "Server error while submitting");
      }
    }
  );
  socket.on("cancel-attendance", async ({ roomName, entryKey }) => {
    const isValid =
      validEntryKeys.has(roomName) &&
      validEntryKeys.get(roomName).has(entryKey);

    if (!isValid) {
      socket.emit("error-message", "❌ Invalid or expired entry key");
      return;
    }
    try {
      const roomSockets = await io.in(roomName).fetchSockets();
      const adminSocket = roomSockets.find(
        (s) => s.handshake.auth?.admin === true
      );

      if (adminSocket) {
        // ✅ Send to admin only
        adminSocket.emit("cancel-attendance", {
          entryKey,
          roomName,
        });
      } else {
        socket.emit("error-message", "Admin not available in room");
      }
      validEntryKeys.get(roomName).delete(entryKey);
    } catch (err) {
      console.error("❌ Error during entry submission:", err);
      socket.emit("error-message", "Server error while submitting");
    }
  });

  //register socket haldlar
  socket.on("register-entry-key", ({ roomName, entryKey }) => {
    if (!validEntryKeys.has(roomName)) {
      validEntryKeys.set(roomName, new Set());
    }
    validEntryKeys.get(roomName).add(entryKey);
  });

  //tab switch

  socket.on("disconnect", () => {
    for (const [roomName, adminSocketId] of adminSockets.entries()) {
      if (socket.id === adminSocketId) {
        // console.log(`🛑 Admin left room: ${roomName} — cleaning up`);

        createdRooms.delete(roomName);
        delete adminCodeState[roomName];
        adminSockets.delete(roomName);
        validEntryKeys.delete(roomName);

        io.to(roomName).emit("room-closed");
      }
    }
  });
});
server.listen(3000, () =>
  console.log("✅ Server running at http://localhost:3000")
);
