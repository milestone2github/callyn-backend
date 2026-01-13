import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// 1. Create a specific connection to the 'internal' database
// This matches the approach in zohoAuth.js
const internalDbConnection = mongoose.createConnection(process.env.MONGO_URI, {
  dbName: "internal",
});

// 2. Define and Register the Department Model first
// This is required for the 'ref' in the User schema to work
const DepartmentSchema = new mongoose.Schema({
  name: String,
});
// Registering as 'DEPARTMENTS' matches the ref used in zohoAuth.js
internalDbConnection.model("DEPARTMENTS", DepartmentSchema);

// 3. Define the Employee/User Schema
const EmployeePhoneSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    // Reference the DEPARTMENTS model using the specific connection's model name
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DEPARTMENTS",
    },
    // Nested structure for phone number
    onboarding: {
      userFilledInfo: {
        personalDetails: {
          phone: String,
        },
      },
    },
  },
  {
    collection: "users", // Target the 'users' collection
    strict: false, // Allow other fields to exist
  }
);

// 4. Register the model on the INTERNAL connection
const EmployeePhoneModel = internalDbConnection.model(
  "EmployeePhoneDetails",
  EmployeePhoneSchema
);

export default EmployeePhoneModel;