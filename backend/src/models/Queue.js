const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseCode: { type: String, required: true },
  location: { type: String, required: true },
  status: { type: String, enum: ['waiting', 'served', 'cancelled'], default: 'waiting' },
  priority: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Queue', queueSchema);
