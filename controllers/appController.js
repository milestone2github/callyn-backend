import MintDbModel from "../schema/MintDbModel.js";
import CallLogModel from "../schema/CallLogModel.js";
import VersionModel from "../schema/VersionModel.js";
import RequestModel from "../schema/RequestModel.js";
import UserDetailsModel from "../schema/UserDetailsModel.js";

// --- Helpers ---
const normalizeName = (name) => (name ? name.toString().toLowerCase().trim() : "");

// --- Request Handlers ---

export const requestAsPersonal = async (req, res) => {
  try {
    const { requestedContact, requestedBy, reason } = req.body;

    if (!requestedContact || !requestedBy || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newRequest = new RequestModel({ requestedContact, requestedBy, reason });
    await newRequest.save();

    console.log(`[Request] New request created by ${requestedBy} for ${requestedContact}`);
    res.status(201).json({ message: "Request submitted successfully", id: newRequest._id });
  } catch (error) {
    console.error("[Request] Error saving:", error.message);
    res.status(500).json({ message: "Error saving request", error: error.message });
  }
};

export const getPendingRequests = async (req, res) => {
  try {
    const pendingRequests = await RequestModel.find({ status: "pending" }).sort({ createdAt: -1 });
    res.json(pendingRequests);
  } catch (error) {
    console.error("[PendingRequests] Error fetching:", error.message);
    res.status(500).json({ message: "Error fetching requests", error: error.message });
  }
};

export const updateRequestStatus = async (req, res) => {
  try {
    const { requestId, status } = req.body;

    if (!requestId || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const validStatuses = ["approved", "rejected", "pending"];
    if (!validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const updatedRequest = await RequestModel.findByIdAndUpdate(
      requestId,
      { status: status.toLowerCase() },
      { new: true }
    );

    if (!updatedRequest) return res.status(404).json({ message: "Request not found" });

    console.log(`[RequestStatus] Request ${requestId} marked as ${status}`);
    res.json({ message: `Request marked as ${status}`, data: updatedRequest });
  } catch (error) {
    console.error("[RequestStatus] Error updating:", error.message);
    res.status(500).json({ message: "Error updating status", error: error.message });
  }
};

// --- Call Log Handlers ---

export const uploadCallLog = async (req, res) => {
  try {
    const { callerName, rshipManagerName, type, timestamp, duration } = req.body;
    const uploadedBy = req.user.name;

    if (!callerName || !type || !timestamp) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newLog = new CallLogModel({
      callerName,
      rshipManagerName: rshipManagerName || "N/A",
      type: type.toLowerCase(),
      timestamp: new Date(Number(timestamp)),
      duration: Number(duration),
      uploadedBy,
    });

    await newLog.save();
    console.log(`[CallLog] Log saved for agent ${uploadedBy}`);
    res.status(201).json({ message: "Call log saved successfully", id: newLog._id });
  } catch (error) {
    console.error("[CallLog] Error saving:", error.message);
    res.status(500).json({ message: "Error saving call log", error: error.message });
  }
};

//get call logs
export const getCallLogs = async (req, res) => {
  try {
    // Extract uploadedBy from query params
    const { rshipManagerName, date, uploadedBy } = req.query; 
    const filter = {};

    // 1. Filter by Relationship Manager Name (Case-insensitive)
    if (rshipManagerName) {
      filter.rshipManagerName = { $regex: new RegExp(rshipManagerName, "i") };
    }

    // 2. Filter by Uploaded By (Case-insensitive) [NEW]
    if (uploadedBy) {
      filter.uploadedBy = { $regex: new RegExp(uploadedBy, "i") };
    }

    // 3. Filter by Date
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      if (!isNaN(startOfDay.getTime())) {
        filter.timestamp = {
          $gte: startOfDay,
          $lte: endOfDay
        };
      } else {
         return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }
    }

    // Fetch logs, sorted by newest first
    const logs = await CallLogModel.find(filter).sort({ timestamp: -1 });

    res.status(200).json({
      count: logs.length,
      data: logs
    });

  } catch (error) {
    console.error("[GetCallLogs] Error:", error.message);
    res.status(500).json({ message: "Error fetching call logs", error: error.message });
  }
};


// --- Data Handlers ---

export const getLegacyData = async (req, res) => {
  try {
    const loggedInUser = req.user.name;

    // Parallel Fetching for performance
    const [mintResults, personalRequests] = await Promise.all([
      MintDbModel.find({}).select({
        NAME: 1, MOBILE: 1, PAN: 1, "RELATIONSHIP  MANAGER": 1, "FAMILY HEAD": 1
      }).lean(),
      RequestModel.find({ requestedBy: loggedInUser, status: "approved" })
        .select("requestedContact")
        .lean()
    ]);

    const excludedNames = new Set(personalRequests.map((r) => normalizeName(r.requestedContact)));
    
    // Filter and Map
    const contacts = mintResults
      .filter((doc) => !excludedNames.has(normalizeName(doc.NAME)))
      .map((doc) => ({
        name: doc.NAME,
        number: (doc.MOBILE || "").replace(/"/g, ""),
        type: "work",
        pan: (doc.PAN || "").replace(/"/g, ""),
        rshipManager: (doc["RELATIONSHIP  MANAGER"] || "").replace(/"/g, ""),
        familyHead: (doc["FAMILY HEAD"] || "").replace(/"/g, ""),
      }));

    res.json(contacts);
  } catch (error) {
    console.error("[LegacyData] Error fetching:", error.message);
    res.status(500).json({ message: "Error fetching data" });
  }
};

export const getLatestVersion = async (req, res) => {
  try {
    const latestVersion = await VersionModel.findOne().sort({ createdAt: -1, _id: -1 });

    if (!latestVersion) {
      return res.status(404).json({ message: "No version info found" });
    }

    res.json({
      latestVersion: latestVersion.version,
      updateType: latestVersion.type,
      changelog: latestVersion.changelog,
      downloadUrl: latestVersion.downloadUrl,
    });
  } catch (error) {
    console.error("[VersionCheck] Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// --- User Details Handler ---

export const syncUserDetails = async (req, res) => {
  try {
    const { username, email, phoneModel, osLevel, appVersion, lastSeen, department } = req.body;

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const updatedUser = await UserDetailsModel.findOneAndUpdate(
      { email: email },
      { 
        username,
        email,
        phoneModel,
        osLevel,
        appVersion,
        department,
        lastSeen: lastSeen || new Date()
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      message: "User details synced successfully",
      user: updatedUser
    });

  } catch (error) {
    console.error("[UserDetails] Error syncing:", error.message);
    return res.status(500).json({ message: "Error syncing details", error: error.message });
  }
};

export const getAllUserDetails = async (req, res) => {
  try {
    // Fetch all users, sorted by 'lastSeen' (newest first)
    const users = await UserDetailsModel.find({}).sort({ lastSeen: -1 });
    
    res.status(200).json(users);
  } catch (error) {
    console.error("[GetUsers] Error fetching:", error.message);
    res.status(500).json({ message: "Error fetching users", error: error.message });
  }
};