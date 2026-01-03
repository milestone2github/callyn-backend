import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import mongoose from "mongoose"; 
import User from "./schema/UserModel.js"; // Milestone User Model
import protect from "./authMiddleware.js";

dotenv.config();
const router = express.Router();

// --- 1. INTERNAL DB CONNECTION (Using Shared URI) ---
// Approach: We use the main MONGO_URI but force the 'dbName' option.
// This allows you to have one env variable but talk to two databases.
const internalDbName = "internal";
let InternalUser;
let InternalDepartment;

try {
  // 'dbName' overrides the database name in the connection string
  const internalDbConnection = mongoose.createConnection(process.env.MONGO_URI, { 
    dbName: internalDbName 
  });
  
  // --- 2. DEFINE SCHEMAS FOR POPULATION ---
  
  // We must register this on the internal connection so 'ref' works
  const InternalDepartmentSchema = new mongoose.Schema({
    name: String
  });
  InternalDepartment = internalDbConnection.model("DEPARTMENTS", InternalDepartmentSchema);

  // User Schema (With reference)
  const InternalUserSchema = new mongoose.Schema({
    email: { type: String, required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "DEPARTMENTS" } 
  });
  InternalUser = internalDbConnection.model("USERS", InternalUserSchema);
  
  console.log(`Internal DB Connection Established to: /${internalDbName}`);

} catch (err) {
  console.error("Failed to connect to Internal DB:", err.message);
}

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

    const { access_token } = tokenResponse.data;
    
    // 2. Fetch User from Zoho (to get the email)
    // NOTE: For production, extract email from 'tokenResponse.data.id_token' using jwt.decode()
    const userEmail = 
    tokenResponse.data.id_token ? jwt.decode(tokenResponse.data.id_token).email : 
    //"ishu@niveshonline.com"; // Hardcoded for testing (MF Department)
    //"vilakshan@niveshonline.com"; // Hardcoded for testing (Management)

    console.log(`Callback: Processed email: ${userEmail}`);

    const peopleResponse = await axios.get(
      `https://people.zoho.com/people/api/forms/P_EmployeeView/records`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${access_token}` },
        params: { searchColumn: "EMPLOYEEMAILALIAS", searchValue: userEmail },
      }
    );

    if (!peopleResponse.data || !Array.isArray(peopleResponse.data) || peopleResponse.data.length === 0) {
      throw new Error("User not found in Zoho People API");
    }

    const zohoUser = peopleResponse.data[0];
    const email = zohoUser["Email ID"];
    const name = `${zohoUser["First Name"]} ${zohoUser["Last Name"]}`.trim();

    // 3. Local Milestone User Logic (Login/Signup)
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ name, email });
    }

    const jwtToken = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "180d" }
    );

    // --- 4. POPULATE DEPARTMENT FROM INTERNAL DB ---
    let departmentName = "N/A";
    
    if (InternalUser) {
        try {
            console.log(`Callback: Fetching department for '${email}'...`);
            
            const internalUserRecord = await InternalUser.findOne({ email: email })
                                                         .populate("department");
            
            if (internalUserRecord && internalUserRecord.department) {
                departmentName = internalUserRecord.department.name || "N/A";
                console.log(`Callback: Found Department Name: ${departmentName}`);
            } else {
                console.log("Callback: Department not found or not assigned.");
            }
        } catch (dbErr) {
            console.error("Callback: Internal DB Error:", dbErr.message);
        }
    }
    // -----------------------------------------------

    const finalRedirect = `${redirectUrl}?token=${jwtToken}&name=${encodeURIComponent(name)}&department=${encodeURIComponent(departmentName)}`;
    res.redirect(finalRedirect);

  } catch (error) {
    console.error("\n--- ZOHO LOGIN FAILED ---");
    console.error("Error:", error.message);
    res.redirect(`${redirectUrl}?login=failed`);
  }
});

router.get("/me", protect, (req, res) => {
  if (!req.user || !req.user.name) {
    return res.status(404).json({ message: "User data not found." });
  }
  res.status(200).json({ name: req.user.name });
});

export default router;
