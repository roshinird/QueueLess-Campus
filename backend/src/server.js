const express = require("express");
const cors = require("cors");
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const queueRoutes = require("./routes/queueRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

// Connect to MongoDB
connectDB();

const app = express();

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH", "DELETE"],
    },
});

// Middleware
app.use(cors());
app.use(express.json());

// Make io available inside controllers
app.set("io", io);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/queues", queueRoutes);
app.use("/api/notifications", notificationRoutes);

// Health check
app.get("/", (req, res) => {
    res.json({
        message: "QueueLess Campus Backend is running",
    });
});

// Socket.IO connection
io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Join a queue room
    socket.on("joinQueueRoom", (queueId) => {
        socket.join(`queue-${queueId}`);

        console.log(
            `Socket ${socket.id} joined queue room: queue-${queueId}`
        );
    });

    // Join a user's personal notification room
    socket.on("joinUserRoom", (userId) => {
        socket.join(`user-${userId}`);

        console.log(
            `Socket ${socket.id} joined user room: user-${userId}`
        );
    });

    // Leave a queue room
    socket.on("leaveQueueRoom", (queueId) => {
        socket.leave(`queue-${queueId}`);

        console.log(
            `Socket ${socket.id} left queue room: queue-${queueId}`
        );
    });

    // Socket disconnected
    socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Socket.IO server is ready");
});