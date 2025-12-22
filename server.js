import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./zohoAuth.js";
import MintDbModel from "./schema/MintDbModel.js";
import CallLogModel from "./schema/CallLogModel.js"; // <--- IMPORT THIS
import protect from "./authMiddleware.js";
import VersionModel from "./schema/VersionModel.js";
import RequestModel from "./schema/RequestModel.js";

dotenv.config();
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Auth routes
app.use("/auth", authRoutes);

//request as personal contact
// --- UPDATED ENDPOINT: Submit Personal Contact Request ---
app.post("/requestAsPersonal", protect, async (req, res) => {
  console.log("\n--- POST /requestAsPersonal: Request received ---");

  try {
    const { requestedContact, requestedBy, reason } = req.body;

    console.log(`Request: Contact '${requestedContact}' requested by '${requestedBy}'`);

    if (!requestedContact || !requestedBy || !reason) {
      return res.status(400).json({ 
        message: "Missing required fields (requestedContact, requestedBy, reason)" 
      });
    }

    // Create document
    // NOTE: 'isApproved' is not passed here, so it defaults to false automatically
    const newRequest = new RequestModel({
      requestedContact,
      requestedBy,
      reason
    });

    await newRequest.save();

    console.log("Request: Saved successfully ID:", newRequest._id);
    res.status(201).json({ message: "Request submitted successfully", id: newRequest._id });

  } catch (error) {
    console.error("\n--- ERROR in /requestAsPersonal ---");
    console.error("Error Message:", error.message);
    res.status(500).json({ message: "Error saving request", error: error.message });
  }
});

// --- NEW ENDPOINT: Upload Call Logs ---
app.post("/uploadCallLog", protect, async (req, res) => {
  console.log("\n--- POST /uploadCallLog: Request received ---");
  
  try {
    const { callerName, rshipManagerName, type, timestamp, duration } = req.body;
    const uploadedBy = req.user.name; // Extracted from the Bearer token by 'protect' middleware

    console.log(`CallLog: Uploading for Agent: '${uploadedBy}'`);
    console.log(`CallLog: Details - Client: ${callerName}, Type: ${type}, Duration: ${duration}s`);

    // Validation
    if (!callerName || !type || !timestamp) {
      return res.status(400).json({ message: "Missing required fields (callerName, type, timestamp)" });
    }

    // Create new document
    const newLog = new CallLogModel({
      callerName,
      rshipManagerName: rshipManagerName || "N/A",
      type: type.toLowerCase(), // Ensure consistency (incoming/outgoing)
      timestamp: new Date(Number(timestamp)), // Convert App timestamp (likely Long/Epoch) to Date
      duration: Number(duration),
      uploadedBy
    });

    // Save to MongoDB
    await newLog.save();

    console.log("CallLog: Saved successfully ID:", newLog._id);
    res.status(201).json({ message: "Call log saved successfully", id: newLog._id });

  } catch (error) {
    console.error("\n--- ERROR in /uploadCallLog ---");
    console.error("Error Message:", error.message);
    res.status(500).json({ message: "Error saving call log", error: error.message });
  }
});

// --- EXISTING ENDPOINT: Get Legacy Data ---
app.get("/getLegacyData", protect, async (req, res) => {
  console.log("\n--- GET /getLegacyData: Request received (user authenticated) ---");
  try {
    const loggedInUser = req.user.name;
    console.log(`LegacyData: Logged in user: '${loggedInUser}'`);
    console.log("LegacyData: Fetching ALL contacts (no manager filter applied).");

    const query = {}; 
    
    const results = await MintDbModel.find(query).select({ 
      NAME: 1, 
      MOBILE: 1, 
      PAN: 1, 
      "RELATIONSHIP  MANAGER": 1,
      'FAMILY HEAD': 1 
    }).lean();

    console.log(`LegacyData: MongoDB query found ${results.length} total contacts.`);

    const contacts = results.map(doc => ({
      name: doc.NAME,
      number: (doc.MOBILE || "").replace(/"/g, ''),
      type: "work",
      pan: (doc.PAN || "").replace(/"/g, ''),
      rshipManager: (doc['RELATIONSHIP  MANAGER'] || "").replace(/"/g, ''),
      familyHead: (doc['FAMILY HEAD'] || "").replace(/"/g, '')
    }));

    if (contacts.length > 0) {
      console.log("LegacyData: First transformed contact:", contacts[0]);
    }
    console.log(`LegacyData: Sending ${contacts.length} transformed contacts to app.`);
    
    res.json(contacts);

  } catch (error) {
    console.error("\n--- ERROR in /getLegacyData ---");
    console.error("Error Message:", error.message);
    res.status(500).json({ message: "Error fetching data" });
  }
});

//version check endpoint
//version check endpoint
app.get("/version/latest", async (req, res) => {
  console.log("\n--- GET /version/latest: Request received ---");

  try {
    console.log("VersionCheck: Querying MongoDB for latest version...");
    
    // Ensure VersionModel is imported at the top of your file if not already!
    // Sort by createdAt first, then use _id to break ties
const latestVersion = await VersionModel.findOne().sort({ createdAt: -1, _id: -1 });
    
    if (!latestVersion) {
      console.log("VersionCheck: No version info found in DB.");
      return res.status(404).json({ message: "No version info found" });
    }

    console.log(`VersionCheck: Found version '${latestVersion.version}' (Type: ${latestVersion.type})`);
    console.log("VersionCheck: Sending JSON response to client.");

    res.json({
      latestVersion: latestVersion.version,
      updateType: latestVersion.type,
      changelog: latestVersion.changelog,
      downloadUrl: latestVersion.downloadUrl
    });

  } catch (error) {
    console.error("\n--- ERROR in /version/latest ---");
    console.error("Error Message:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected Successfully");
    app.listen(process.env.PORT, () => {
      console.log(`Server running on http://localhost:${process.env.PORT}`);
    });
  })
  .catch(err => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });