import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

export const internalDbConnection = mongoose
  .createConnection(process.env.MONGO_URI, { dbName: "internal" })
  .asPromise()
  .then((conn) => {
    console.log("Internal DB connected (dbName: internal)");
    return conn;
  })
  .catch((err) => {
    console.error("Internal DB connection failed:", err.message);
    throw err;
  });
