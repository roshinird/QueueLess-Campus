const mongoose = require("mongoose");

const queueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },

    managedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    maxCapacity: {
      type: Number,
      default: 100,
      min: 1,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Queue", queueSchema);