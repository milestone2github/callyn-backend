import mongoose from "mongoose";

const RequestSchema = new mongoose.Schema({
  requestedContact: { type: String, required: true },
  requestedBy: { type: String, required: true },
  reason: { type: String, required: true },
  isApproved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("callyn-personalContact-request", RequestSchema);