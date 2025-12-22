import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "./schema/UserModel.js";
import protect from "./authMiddleware.js"; // <-- Import middleware

dotenv.config();
const router = express.Router();

// Step 1: Send auth URL to the mobile app (Unchanged)
router.get("/zoho", (req, res) => {
  console.log("GET /auth/zoho: Request received");
  const redirectUrl = req.query.redirect || process.env.DEFAULT_FRONTEND_URL;
  const state = encodeURIComponent(JSON.stringify({ redirectUrl }));
  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?response_type=code&client_id=${process.env.ZOHO_CLIENT_ID}&scope=profile,email,ZOHOPEOPLE.forms.ALL&redirect_uri=${process.env.ZOHO_REDIRECT_URI}&access_type=offline&state=${state}`;
  console.log(`GET /auth/zoho: Sending authUrl for redirect: ${redirectUrl}`);
  res.json({ authUrl: authUrl });
});

// Step 2: Handle Zoho callback (Updated with logs)
router.get("/zoho/callback", async (req, res) => {
  console.log("\n--- GET /auth/zoho/callback: Request received ---");
  const code = req.query.code;
  const state = req.query.state ? JSON.parse(decodeURIComponent(req.query.state)) : {};
  const redirectUrl = state.redirectUrl || process.env.DEFAULT_FRONTEND_URL;

  console.log(`Callback: Received code: ${code ? 'Yes' : 'No'}`);
  console.log(`Callback: Target redirectUrl: ${redirectUrl}`);

  if (!code) {
    console.error("Callback: Error - No code received from Zoho.");
    return res.redirect(`${redirectUrl}?login=failed&error=nocode`);
  }

  try {
    console.log("Callback: Step 1 - Exchanging code for access token...");
    const tokenResponse = await axios.post("https://accounts.zoho.com/oauth/v2/token", null, {
        params: {
          grant_type: "authorization_code",
          client_id: process.env.ZOHO_CLIENT_ID,
          client_secret: process.env.ZOHO_CLIENT_SECRET,
          redirect_uri: process.env.ZOHO_REDIRECT_URI,
          code,
        },
    });

    const { access_token, id_token } = tokenResponse.data;
    console.log("Callback: Step 1 - Success. Received access_token and id_token.");

    const decoded = jwt.decode(id_token);
    console.log("Callback: Step 2 - Decoded id_token:", decoded);
    //const userEmail = decoded.email;
    const userEmail = "ishu@niveshonline.com";//hardcoded mail for testing
    console.log(`Callback: Step 2 - Using email for Zoho People search: ${userEmail}`);

    console.log("Callback: Step 3 - Fetching user from Zoho People API...");
    const peopleResponse = await axios.get(
      `https://people.zoho.com/people/api/forms/P_EmployeeView/records`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${access_token}` },
        params: { searchColumn: "EMPLOYEEMAILALIAS", searchValue: userEmail },
      }
    );

    console.log(`Callback: Step 3 - Zoho People API responded with status: ${peopleResponse.status}`);
    if (!peopleResponse.data || !Array.isArray(peopleResponse.data) || peopleResponse.data.length === 0) {
      console.error(`Callback: Error - User '${userEmail}' not found in Zoho People API.`);
      throw new Error("User not found in Zoho People API");
    }

    const zohoUser = peopleResponse.data[0];
    console.log("Callback: Step 3 - Success. Found Zoho user:", zohoUser);
    
    const email = zohoUser["Email ID"];
    const name = `${zohoUser["First Name"]} ${zohoUser["Last Name"]}`.trim();
    console.log(`Callback: Step 4 - Extracted Name: '${name}', Email: '${email}'`);

    console.log(`Callback: Step 5 - Checking local MongoDB for user '${email}'...`);
    let user = await User.findOne({ email });
    if (!user) {
      console.log(`Callback: Step 5 - User not found. Creating new user in MongoDB...`);
      user = await User.create({ name, email });
      console.log("Callback: Step 5 - New user created:", user);
    } else {
      console.log("Callback: Step 5 - User found in MongoDB:", user);
    }

    console.log("Callback: Step 6 - Generating JWT for local user...");
    const jwtToken = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "180d" }
    );
    console.log("Callback: Step 6 - JWT generated successfully.");

    // Redirect back to frontend with token
    const finalRedirect = `${redirectUrl}?token=${jwtToken}`;
    console.log(`Callback: Step 7 - Success! Redirecting to: ${finalRedirect}`);
    res.redirect(finalRedirect);

  } catch (error) {
    console.error("\n--- ZOHO LOGIN FAILED (Callback catch block) ---");
    // Log the full error object, including potential response data from failed axios requests
    if (error.response) {
      console.error("Axios Error Status:", error.response.status);
      console.error("Axios Error Data:", error.response.data);
    } else {
      console.error("Error Message:", error.message);
      console.error("Full Error:", error);
    }
    console.error("-------------------------------------------------");
    res.redirect(`${redirectUrl}?login=failed`);
  }
});

// --- ADD THIS NEW ENDPOINT ---
// Step 3: Get Logged-In User's Details
// The 'protect' middleware runs first, verifies the token, and adds 'req.user'
router.get("/me", protect, (req, res) => {
  console.log("\nGET /auth/me: Request received (user authenticated)");
  // req.user was attached by the 'protect' middleware
  if (!req.user || !req.user.name) {
    console.error("GET /auth/me: Error - User data not found in token payload:", req.user);
    return res.status(404).json({ message: "User data not found in token." });
  }
  
  // Return the name from the validated token payload
  console.log(`GET /auth/me: Sending user name: ${req.user.name}`);
  res.status(200).json({ name: req.user.name });
});
// ------------------------------

export default router;