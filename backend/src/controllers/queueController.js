const Queue = require("../models/Queue");
const QueueToken = require("../models/QueueToken");
const Notification = require("../models/Notification");

// ============================================================
// CREATE A NEW QUEUE
// ============================================================
exports.createQueue = async (req, res) => {
    try {
        const { name, description, location, maxCapacity } = req.body;

        if (!name || !location) {
            return res.status(400).json({
                message: "Queue name and location are required",
            });
        }

        const queue = await Queue.create({
            name,
            description,
            location,
            maxCapacity: maxCapacity || 100,
            managedBy: req.user.id,
        });

        res.status(201).json({
            message: "Queue created successfully",
            queue,
        });
    } catch (error) {
        console.error("Create queue error:", error);

        res.status(500).json({
            message: "Server error while creating queue",
        });
    }
};


// ============================================================
// GET ALL OPEN QUEUES
// ============================================================
exports.getQueues = async (req, res) => {
    try {
        const queues = await Queue.find({ status: "open" })
            .populate("managedBy", "name email role")
            .sort({ createdAt: -1 });

        res.json({
            count: queues.length,
            queues,
        });
    } catch (error) {
        console.error("Get queues error:", error);

        res.status(500).json({
            message: "Server error while fetching queues",
        });
    }
};


// ============================================================
// GET QUEUE BY ID
// ============================================================
exports.getQueueById = async (req, res) => {
    try {
        const queue = await Queue.findById(req.params.id)
            .populate("managedBy", "name email role");

        if (!queue) {
            return res.status(404).json({
                message: "Queue not found",
            });
        }

        res.json({
            queue,
        });
    } catch (error) {
        console.error("Get queue error:", error);

        res.status(500).json({
            message: "Server error while fetching queue",
        });
    }
};


// ============================================================
// CLOSE QUEUE
// ============================================================
exports.closeQueue = async (req, res) => {
    try {
        const queue = await Queue.findById(req.params.id);

        if (!queue) {
            return res.status(404).json({
                message: "Queue not found",
            });
        }

        if (
            queue.managedBy.toString() !== req.user.id &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                message: "Not authorized to close this queue",
            });
        }

        queue.status = "closed";

        await queue.save();

        res.json({
            message: "Queue closed successfully",
            queue,
        });
    } catch (error) {
        console.error("Close queue error:", error);

        res.status(500).json({
            message: "Server error while closing queue",
        });
    }
};


// ============================================================
// JOIN QUEUE
// ============================================================
exports.joinQueue = async (req, res) => {
    try {
        const queueId = req.params.id;

        // Check if queue exists
        const queue = await Queue.findById(queueId);

        if (!queue) {
            return res.status(404).json({
                message: "Queue not found",
            });
        }

        // Check if queue is open
        if (queue.status !== "open") {
            return res.status(400).json({
                message: "This queue is currently closed",
            });
        }

        // Count active tokens
        const waitingCount = await QueueToken.countDocuments({
            queue: queueId,
            status: {
                $in: ["waiting", "serving"],
            },
        });

        // Check capacity
        if (waitingCount >= queue.maxCapacity) {
            return res.status(400).json({
                message: "Queue is currently full",
            });
        }

        // Check if user already has an active token
        const existingToken = await QueueToken.findOne({
            queue: queueId,
            user: req.user.id,
            status: {
                $in: ["waiting", "serving"],
            },
        });

        if (existingToken) {
            return res.status(400).json({
                message: "You are already in this queue",
                token: existingToken,
            });
        }

        // Find latest token number
        const lastToken = await QueueToken.findOne({
            queue: queueId,
        }).sort({
            tokenNumber: -1,
        });

        const nextTokenNumber = lastToken
            ? lastToken.tokenNumber + 1
            : 1;

        // Create token
        const token = await QueueToken.create({
            queue: queueId,
            user: req.user.id,
            tokenNumber: nextTokenNumber,
            status: "waiting",
        });

        res.status(201).json({
            message: "Successfully joined queue",
            token,
            position: waitingCount + 1,
        });

    } catch (error) {
        console.error("Join queue error:", error);

        res.status(500).json({
            message: "Server error while joining queue",
        });
    }
};


// ============================================================
// CANCEL QUEUE TOKEN
// ============================================================
exports.cancelQueue = async (req, res) => {
    try {
        const queueId = req.params.id;

        const token = await QueueToken.findOne({
            queue: queueId,
            user: req.user.id,
            status: "waiting",
        });

        if (!token) {
            return res.status(404).json({
                message: "No active queue token found",
            });
        }

        token.status = "cancelled";
        token.cancelledAt = new Date();

        await token.save();

        res.json({
            message: "Queue token cancelled successfully",
            token,
        });

    } catch (error) {
        console.error("Cancel queue error:", error);

        res.status(500).json({
            message: "Server error while cancelling queue token",
        });
    }
};


// ============================================================
// STAFF — CALL NEXT STUDENT
// ============================================================
exports.callNextStudent = async (req, res) => {
    try {
        const queueId = req.params.id;

        // Only staff/admin can call the next student
        if (
            req.user.role !== "staff" &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                message: "Access denied. Staff only.",
            });
        }

        // Find first waiting token
        const nextToken = await QueueToken.findOne({
            queue: queueId,
            status: "waiting",
        }).sort({
            tokenNumber: 1,
        });

        if (!nextToken) {
            return res.status(404).json({
                message: "No students are waiting in this queue.",
            });
        }

        // Change token status to serving
        nextToken.status = "serving";

        await nextToken.save();

        // Get queue information
        const queue = await Queue.findById(queueId);

        // Create database notification
        await Notification.create({
            user: nextToken.user,
            title: "Your turn!",
            message: `Token #${nextToken.tokenNumber} is now being served at ${
                queue ? queue.name : "the queue"
            }.`,
            type: "info",
            payload: {
                queueId: queueId,
                tokenId: nextToken._id,
                tokenNumber: nextToken.tokenNumber,
            },
        });

        // Get Socket.IO instance
        const io = req.app.get("io");

        // Send real-time event to queue room
        if (io) {
            io.to(`queue-${queueId}`).emit("tokenCalled", {
                queueId: queueId,
                tokenId: nextToken._id,
                tokenNumber: nextToken.tokenNumber,
                status: nextToken.status,
                userId: nextToken.user,
                message: `Token #${nextToken.tokenNumber} is now being served.`,
            });
        }

        res.json({
            message: "Next student called successfully",
            token: nextToken,
        });

    } catch (error) {
        console.error("Call next student error:", error);

        res.status(500).json({
            message: "Server error while calling next student",
        });
    }
};


// ============================================================
// STAFF — SERVE TOKEN
// ============================================================
exports.serveToken = async (req, res) => {
    try {
        const tokenId = req.params.tokenId;

        // Only staff/admin can serve students
        if (
            req.user.role !== "staff" &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                message: "Access denied. Staff only.",
            });
        }

        const token = await QueueToken.findById(tokenId);

        if (!token) {
            return res.status(404).json({
                message: "Queue token not found",
            });
        }

        // Token must currently be serving
        if (token.status !== "serving") {
            return res.status(400).json({
                message: `Cannot serve token with status: ${token.status}`,
            });
        }

        token.status = "served";
        token.servedAt = new Date();

        await token.save();

        res.json({
            message: "Student served successfully",
            token,
        });

    } catch (error) {
        console.error("Serve token error:", error);

        res.status(500).json({
            message: "Server error while serving queue token",
        });
    }
};


// ============================================================
// GET ALL TOKENS FOR A QUEUE
// ============================================================
exports.getQueueTokens = async (req, res) => {
    try {
        const queueId = req.params.id;

        const tokens = await QueueToken.find({
            queue: queueId,
        })
            .populate("user", "name email role")
            .sort({
                tokenNumber: 1,
            });

        res.json({
            queueId,
            totalTokens: tokens.length,
            tokens,
        });

    } catch (error) {
        console.error("Get queue tokens error:", error);

        res.status(500).json({
            message: "Server error while getting queue tokens",
        });
    }
};


// ============================================================
// GET CURRENT USER'S ACTIVE TOKEN
// ============================================================
exports.getMyToken = async (req, res) => {
    try {
        const queueId = req.params.id;
        const userId = req.user.id;

        const myToken = await QueueToken.findOne({
            queue: queueId,
            user: userId,
            status: {
                $in: ["waiting", "serving"],
            },
        });

        if (!myToken) {
            return res.status(404).json({
                message: "You do not have an active token in this queue.",
            });
        }

        let position = 0;

        if (myToken.status === "waiting") {
            const peopleAhead = await QueueToken.countDocuments({
                queue: queueId,
                status: "waiting",
                tokenNumber: {
                    $lt: myToken.tokenNumber,
                },
            });

            position = peopleAhead + 1;
        }

        res.json({
            message: "Current token retrieved successfully",
            token: myToken,
            position,
        });

    } catch (error) {
        console.error("Get my token error:", error);

        res.status(500).json({
            message: "Server error while getting your token",
        });
    }
};