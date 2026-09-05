const mongoose = require("mongoose");

const queueTokenSchema = new mongoose.Schema(
  {
    queue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Queue",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    tokenNumber: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["waiting", "serving", "served", "cancelled"],
      default: "waiting",
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },

    servedAt: {
      type: Date,
    },

    cancelledAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Every token number must be unique within a queue.
queueTokenSchema.index(
  { queue: 1, tokenNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model("QueueToken", queueTokenSchema);