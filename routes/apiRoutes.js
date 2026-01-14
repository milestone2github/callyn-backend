import express from "express";
import protect from "../authMiddleware.js";
import {
  requestAsPersonal,
  getPendingRequests,
  updateRequestStatus,
  uploadCallLog,
  getLegacyData,
  getLatestVersion,
  syncUserDetails,
  getAllUserDetails,
  getEmployeePhoneDetails,
  getCallLogs,
} from "../controllers/appController.js";

const router = express.Router();

// Request Routes
router.post("/requestAsPersonal", protect, requestAsPersonal);
router.get("/getPendingRequests", protect, getPendingRequests);
router.put("/updateRequestStatus", protect, updateRequestStatus);

// Data Routes
router.post("/uploadCallLog", protect, uploadCallLog);
router.get("/getCallLogs", protect, getCallLogs);
router.get("/getLegacyData", protect, getLegacyData);

// Version Route
router.get("/version/latest", getLatestVersion);

// User Details Sync Route
router.post("/syncUserDetails", protect, syncUserDetails);
router.get("/getUserDetails", protect, getAllUserDetails);

//get employee phone details
router.get("/getEmployeePhoneDetails", protect, getEmployeePhoneDetails);

export default router;