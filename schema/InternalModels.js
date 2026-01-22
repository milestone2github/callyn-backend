
import mongoose from "mongoose";
import { internalDbConnection } from "../db/connection.js";

const conn = await internalDbConnection;

// Department schema
const departmentSchema = new mongoose.Schema({
    name: String
});
export const Department = conn.model("DEPARTMENTS", departmentSchema);


// Asset Types schema
const assetTypeSchema = new mongoose.Schema({
  name: String
})
export const AssetType = conn.model("AssetType", assetTypeSchema);


// Asset schema
const assetSchema = new mongoose.Schema({
  type: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetType', required: true },
  status: String,
  assetName: String,
  serialNumber: String,
  brandName: String,
  assetName: String,
  assetCode: String,
});
export const Assets = conn.model("Asset", assetSchema);


// User Schema (With reference)
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: "DEPARTMENTS" },
  assets: [{
    asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset'},
    status: String
  }]
});
export const User = conn.model("USERS", userSchema);