const Notification = require("../models/Notification");

// Get current user's notifications
exports.getMyNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({
            user: req.user.id,
        }).sort({ createdAt: -1 });

        res.json({
            notifications,
        });
    } catch (error) {
        console.error("Get notifications error:", error);

        res.status(500).json({
            message: "Server error while getting notifications",
        });
    }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!notification) {
            return res.status(404).json({
                message: "Notification not found",
            });
        }

        notification.read = true;

        await notification.save();

        res.json({
            message: "Notification marked as read",
            notification,
        });
    } catch (error) {
        console.error("Mark notification as read error:", error);

        res.status(500).json({
            message: "Server error while updating notification",
        });
    }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            {
                user: req.user.id,
                read: false,
            },
            {
                $set: { read: true },
            }
        );

        res.json({
            message: "All notifications marked as read",
        });
    } catch (error) {
        console.error("Mark all notifications as read error:", error);

        res.status(500).json({
            message: "Server error while updating notifications",
        });
    }
};