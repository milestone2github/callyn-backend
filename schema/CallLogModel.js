// schema/CallLogModel.js
import mongoose from "mongoose";

const CallLogSchema = new mongoose.Schema({
  callerName: { 
    type: String, 
    default: "Unknown"
  },
  familyHead: {
    type: String,
    default: "Unknown"
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
  notes: {
    type: String,
    default: "",
    required: false
  },
  // We automatically add who uploaded this based on the Bearer token
  uploadedBy: { 
    type: String, 
    required: true 
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  simslot: {
    type: String,
    default: null
  },
  isWork: {
    type: Boolean,
    default: true,
  }
});

// TTL index: Documents will expire after 90 days (7,776,000 seconds)
CallLogSchema.index({ uploadedAt: 1 }, { expireAfterSeconds: 7776000 });

// This will create a collection named 'calllogs' (mongoose automatically lowercases and pluralizes)
export default mongoose.model("CallLog", CallLogSchema);