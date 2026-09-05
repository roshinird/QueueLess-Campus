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
        const userId = req.user.id;

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

        // Check if user already has an active token
        const existingToken = await QueueToken.findOne({
            queue: queueId,
            user: userId,
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

        // Count active tokens
        const activeTokenCount = await QueueToken.countDocuments({
            queue: queueId,
            status: {
                $in: ["waiting", "serving"],
            },
        });

        // Check capacity
        if (activeTokenCount >= queue.maxCapacity) {
            return res.status(400).json({
                message: "Queue is currently full",
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

        let token;

        try {
            token = await QueueToken.create({
                queue: queueId,
                user: userId,
                tokenNumber: nextTokenNumber,
                status: "waiting",
            });
        } catch (createError) {
            // MongoDB duplicate-key error.
            // This can happen when two users join at almost
            // exactly the same time and both calculate the same
            // next token number.
            if (createError.code === 11000) {
                const latestToken = await QueueToken.findOne({
                    queue: queueId,
                }).sort({
                    tokenNumber: -1,
                });

                const retryTokenNumber = latestToken
                    ? latestToken.tokenNumber + 1
                    : 1;

                token = await QueueToken.create({
                    queue: queueId,
                    user: userId,
                    tokenNumber: retryTokenNumber,
                    status: "waiting",
                });
            } else {
                throw createError;
            }
        }

        // Position is calculated from active tokens with a lower
        // token number.
        const peopleAhead = await QueueToken.countDocuments({
            queue: queueId,
            status: {
                $in: ["waiting", "serving"],
            },
            tokenNumber: {
                $lt: token.tokenNumber,
            },
        });

        // Real-time notification for clients currently watching
        // this queue.
        const io = req.app.get("io");

        if (io) {
            io.to(`queue-${queueId}`).emit("queueUpdated", {
                queueId,
                event: "studentJoined",
                tokenId: token._id,
                tokenNumber: token.tokenNumber,
                status: token.status,
                activeTokenCount: activeTokenCount + 1,
            });
        }

        res.status(201).json({
            message: "Successfully joined queue",
            token,
            position: peopleAhead + 1,
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

        const io = req.app.get("io");

        if (io) {
            io.to(`queue-${queueId}`).emit("queueUpdated", {
                queueId,
                event: "tokenCancelled",
                tokenId: token._id,
                tokenNumber: token.tokenNumber,
                status: token.status,
            });
        }

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

        // Check queue exists
        const queue = await Queue.findById(queueId);

        if (!queue) {
            return res.status(404).json({
                message: "Queue not found",
            });
        }

        // Verify staff owns the queue.
        // Admins can manage any queue.
        if (
            req.user.role !== "admin" &&
            queue.managedBy.toString() !== req.user.id
        ) {
            return res.status(403).json({
                message: "Not authorized to manage this queue",
            });
        }

        // Do not call another student while one is already serving.
        const currentServingToken = await QueueToken.findOne({
            queue: queueId,
            status: "serving",
        });

        if (currentServingToken) {
            return res.status(400).json({
                message: `Token #${currentServingToken.tokenNumber} is currently being served`,
                token: currentServingToken,
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

        // Create database notification
        await Notification.create({
            user: nextToken.user,
            title: "Your turn!",
            message: `Token #${nextToken.tokenNumber} is now being served at ${queue.name}.`,
            type: "info",
            payload: {
                queueId: queueId,
                tokenId: nextToken._id,
                tokenNumber: nextToken.tokenNumber,
            },
        });

        // Get Socket.IO instance
        const io = req.app.get("io");

        if (io) {
            // Notify everyone watching the queue.
            io.to(`queue-${queueId}`).emit("tokenCalled", {
                queueId: queueId,
                tokenId: nextToken._id,
                tokenNumber: nextToken.tokenNumber,
                status: nextToken.status,
                userId: nextToken.user,
                message: `Token #${nextToken.tokenNumber} is now being served.`,
            });

            // Notify the specific student's room.
            io.to(`user-${nextToken.user}`).emit("notification", {
                title: "Your turn!",
                message: `Token #${nextToken.tokenNumber} is now being served at ${queue.name}.`,
                type: "info",
                queueId,
                tokenId: nextToken._id,
                tokenNumber: nextToken.tokenNumber,
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
        const queueId = req.params.id;
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

        // Check queue exists
        const queue = await Queue.findById(queueId);

        if (!queue) {
            return res.status(404).json({
                message: "Queue not found",
            });
        }

        // Verify staff owns the queue.
        // Admins can manage any queue.
        if (
            req.user.role !== "admin" &&
            queue.managedBy.toString() !== req.user.id
        ) {
            return res.status(403).json({
                message: "Not authorized to manage this queue",
            });
        }

        // Make sure the token belongs to this queue
        const token = await QueueToken.findOne({
            _id: tokenId,
            queue: queueId,
        });

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

        const io = req.app.get("io");

        if (io) {
            io.to(`queue-${queueId}`).emit("queueUpdated", {
                queueId,
                event: "tokenServed",
                tokenId: token._id,
                tokenNumber: token.tokenNumber,
                status: token.status,
            });

            io.to(`user-${token.user}`).emit("queueUpdated", {
                queueId,
                event: "tokenServed",
                tokenId: token._id,
                tokenNumber: token.tokenNumber,
                status: token.status,
            });
        }

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

        // Check queue exists
        const queue = await Queue.findById(queueId);

        if (!queue) {
            return res.status(404).json({
                message: "Queue not found",
            });
        }

        // Staff can only view queues they manage.
        // Admins can view any queue.
        if (
            req.user.role !== "admin" &&
            queue.managedBy.toString() !== req.user.id
        ) {
            return res.status(403).json({
                message: "Not authorized to view this queue",
            });
        }

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