const express = require("express");

const router = express.Router();

const {
    createQueue,
    getQueues,
    getQueueById,
    closeQueue,
    joinQueue,
    cancelQueue,
    callNextStudent,
    serveToken,
    getQueueTokens,
    getMyToken,
} = require("../controllers/queueController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

// All queue routes require login
router.use(protect);

// Student/Staff/Admin: Queue operations
router.post("/", createQueue);
router.get("/", getQueues);
router.get("/:id", getQueueById);

// Staff/Admin: close queue
router.patch("/:id/close", authorize("staff", "admin"), closeQueue);

// Student: join queue
router.post("/:id/join", authorize("student"), joinQueue);

// Student: cancel own token
router.patch("/:id/cancel", authorize("student"), cancelQueue);

// Staff/Admin: call next student
router.post(
    "/:id/call-next",
    authorize("staff", "admin"),
    callNextStudent
);

// Staff/Admin: serve student
router.patch(
    "/:id/tokens/:tokenId/serve",
    authorize("staff", "admin"),
    serveToken
);

// Staff/Admin: view queue tokens
router.get(
    "/:id/tokens",
    authorize("staff", "admin"),
    getQueueTokens
);

// Student: view own token
router.get(
    "/:id/my-token",
    authorize("student"),
    getMyToken
);

module.exports = router;