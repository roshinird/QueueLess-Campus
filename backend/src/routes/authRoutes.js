const express = require("express");

const {
    register,
    login
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected route
router.get("/me", protect, (req, res) => {
    res.json({
        user: req.user
    });
});

module.exports = router;
