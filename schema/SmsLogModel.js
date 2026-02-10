import mongoose from "mongoose";

const SmsLogSchema = new mongoose.Schema({
  sender: { 
    type: String, 
    default: "Unknown"
  },
    message: {
    type: String,
    default: "",
  },
  timestamp: { 
    type: Date,
    required: true
  },
  uploadedBy: { 
    type: String, 
    required: true
  },
});

SmsLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 300 });

export default mongoose.model("Callyn-sms", SmsLogSchema);