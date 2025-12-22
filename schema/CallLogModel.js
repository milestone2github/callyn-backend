// schema/CallLogModel.js
import mongoose from "mongoose";

const CallLogSchema = new mongoose.Schema({
  callerName: { 
    type: String, 
    required: true 
  },
  rshipManagerName: { 
    type: String, 
    default: "Unknown" 
  },
  type: { 
    type: String, 
    required: true,
    enum: ['incoming', 'outgoing', 'missed', 'rejected'] 
  },
  timestamp: { 
    type: Date, // We will convert the incoming epoch timestamp to a Date object
    required: true 
  },
  duration: { 
    type: Number, 
    required: true // Duration in seconds
  },
  // We automatically add who uploaded this based on the Bearer token
  uploadedBy: { 
    type: String, 
    required: true 
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

// This will create a collection named 'calllogs' (mongoose automatically lowercases and pluralizes)
export default mongoose.model("CallLog", CallLogSchema);