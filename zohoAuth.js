import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import protect from "./authMiddleware.js";
import { User } from "./schema/InternalModels.js";
import { getAllocatedSimSerial } from "./utils/getAllocatedSimSerial.js";

dotenv.config();
const router = express.Router();

router.get("/zoho", (req, res) => {
  console.log("GET /auth/zoho: Request received");
  const redirectUrl = req.query.redirect || process.env.DEFAULT_FRONTEND_URL;
  const state = encodeURIComponent(JSON.stringify({ redirectUrl }));
  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?response_type=code&client_id=${process.env.ZOHO_CLIENT_ID}&scope=profile,email,ZOHOPEOPLE.forms.ALL&redirect_uri=${process.env.ZOHO_REDIRECT_URI}&access_type=offline&state=${state}`;
  res.json({ authUrl: authUrl });
});

router.get("/zoho/callback", async (req, res) => {
  console.log("\n--- GET /auth/zoho/callback: Request received ---");
  const code = req.query.code;
  const state = req.query.state ? JSON.parse(decodeURIComponent(req.query.state)) : {};
  const redirectUrl = state.redirectUrl || process.env.DEFAULT_FRONTEND_URL;

  if (!code) {
    return res.redirect(`${redirectUrl}?login=failed&error=nocode`);
  }

  try {
    // 1. Exchange Code for Tokens
    const tokenResponse = await axios.post("https://accounts.zoho.com/oauth/v2/token", null, {
        params: {
          grant_type: "authorization_code",
          client_id: process.env.ZOHO_CLIENT_ID,
          client_secret: process.env.ZOHO_CLIENT_SECRET,
          redirect_uri: process.env.ZOHO_REDIRECT_URI,
          code,
        },
    });

    // const { access_token } = tokenResponse.data;
    
    // 2. extract user email from the token
    let id_token = tokenResponse.data.id_token;
    const decode = jwt.decode(id_token);
    const email = decode.email 
    // const userEmail = "ishu@niveshonline.com"; // Hardcoded for testing (MF Department)
    // const userEmail = "vilakshan@niveshonline.com"; // Hardcoded for testing (Management)

    console.log(`Callback: Processed email: ${email}`);

    // 3. Check if user exists in our internal DB and populate the required fields
    const user = await User.findOne({ email })
      .select("-onboarding")
      .populate({
        path: "department",
        select: "name",
      })
      .populate({
        path: "assets.asset",
        match: { status: "allocated" }, // Asset.status
        populate: {
          path: "type",
          match: { name: "SIM Card" }, // AssetType.name
          select: "name",
        },
      });

    if (!user) {
      throw new Error('Your account is not authorized to access this application.')
    }

    // 4. generate JWT token
    const jwtToken = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "180d" }
    );

    // 5. Extract allocated SIM and department name if any
    const allocatedSIM = getAllocatedSimSerial(user) || "N/A";
    const departmentName = user.department.name || "N/A";
    
    // 6. Generate a final redirect URL appending user info like name, email, deptartment, SIM
    const finalRedirect = `${redirectUrl}?token=${jwtToken}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(email)}&department=${encodeURIComponent(departmentName)}&work_phone=${encodeURIComponent(allocatedSIM)}`;
    res.redirect(finalRedirect);
    
  } catch (error) {
    console.error("\n--- ZOHO LOGIN FAILED ---");
    console.error("Error:", error.message);
    const errorMsg = error.message || 'Internal server error';
    res.redirect(`${redirectUrl}?login=failed&msg=${encodeURIComponent(errorMsg)}`);
  }
});

router.get("/me", protect, (req, res) => {
  if (!req.user || !req.user.name) {
    return res.status(404).json({ message: "User data not found." });
  }
  res.status(200).json({ name: req.user.name });
});

export default router;
