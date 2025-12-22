import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  role: { type: String, default: "user" },
});

export default mongoose.model("UserModels", userSchema);
