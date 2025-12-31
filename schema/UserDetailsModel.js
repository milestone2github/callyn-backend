import mongoose from "mongoose";

const UserDetailsSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  department: String,
  phoneModel: String,
  osLevel: String,
  appVersion: String,
  lastSeen: { type: Date, default: Date.now },
}, { 
  collection: 'callyn-user-details',
  timestamps: true 
});

export default mongoose.model("UserDetails", UserDetailsSchema);