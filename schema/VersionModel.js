import mongoose from "mongoose";

const VersionSchema = new mongoose.Schema({
  version: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['hard', 'soft'], 
    default: 'soft' 
  },
  changelog: { type: String, default: "Bug fixes and improvements." },
  downloadUrl: { type: String, required: true }, 
  createdAt: { type: Date, default: Date.now }
}, { collection: 'callyn-version' }); // <--- FIX: Force exact collection name

export default mongoose.model("callyn-version", VersionSchema);