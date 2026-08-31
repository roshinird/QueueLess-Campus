const express = require("express");

const router = express.Router();

const {
    getMyNotifications,
    markAsRead,
    markAllAsRead,
} = require("../controllers/notificationController");

const protect = require("../middleware/authMiddleware");

// All notification routes require login
router.use(protect);

// Get current user's notifications
router.get("/", getMyNotifications);

// Mark all notifications as read
router.patch("/read-all", markAllAsRead);

// Mark one notification as read
router.patch("/:id/read", markAsRead);

module.exports = router;