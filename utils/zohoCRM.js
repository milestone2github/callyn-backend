import axios from "axios";
import dotenv from "dotenv";
import MintDbModel from "../schema/MintDbModel.js";

dotenv.config();

/**
 * HELPER: Strictly normalize phone numbers to the last 10 digits.
 * Returns null if the valid digit count is less than 10.
 */
const normalizePhoneNumber = (rawInput) => {
  if (!rawInput) return null;

  // Strip non-numeric chars
  const digitsOnly = String(rawInput).replace(/\D/g, "");

  // Need at least 10 digits
  if (digitsOnly.length < 10) return null;

  // Last 10 digits
  return digitsOnly.slice(-10);
};

/**
 * Returns Date object for 3 months ago
 */
const getDate3MonthsAgo = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  return date;
};

/**
 * Generates a fresh Access Token
 */
const getAccessToken = async () => {
  try {
    const params = new URLSearchParams();

    params.append("refresh_token", process.env.ZOHO_REFRESH_TOKEN);
    params.append("client_id", process.env.ZOHO_CLIENT_ID);
    params.append("client_secret", process.env.ZOHO_CLIENT_SECRET);
    params.append("grant_type", "refresh_token");

    const response = await axios.post(
      "https://accounts.zoho.com/oauth/v2/token",
      params
    );

    if (response.data.error) {
      throw new Error(`Zoho Auth Error: ${response.data.error}`);
    }

    return response.data.access_token;
  } catch (error) {
    console.error("!!! Error generating token:", error.message);
    throw error;
  }
};

/**
 * Fetches all mobile numbers from Legacy Data (MintDbModel)
 */
const fetchLegacyMobiles = async () => {
  try {
    const legacyDocs = await MintDbModel.find({
      MOBILE: { $exists: true, $ne: "" },
    })
      .select({ MOBILE: 1 })
      .lean();

    const legacySet = new Set();

    legacyDocs.forEach((doc) => {
      const normalized = normalizePhoneNumber(doc.MOBILE);
      if (normalized) {
        legacySet.add(normalized);
      }
    });

    console.log(
      `[LegacyData] Loaded ${legacySet.size} unique existing clients`
    );

    return legacySet;
  } catch (error) {
    console.error("!!! Error fetching legacy data:", error.message);
    return new Set();
  }
};

/**
 * Normalizes record
 */
const normalizeRecord = (moduleName, record) => {
  const safeStr = (val) =>
    val !== null && val !== undefined && val !== ""
      ? String(val).trim()
      : "N/A";

  let clientName = safeStr(record.Name);
  let rawMobile = "N/A";
  let ownerName =
    record.Owner && record.Owner.name
      ? safeStr(record.Owner.name)
      : "N/A";

  let id = "N/A";
  let product = "N/A";

  if (moduleName === "Tickets") {
    rawMobile = safeStr(record.Phone);
    id = safeStr(record.TicketID);

    const subject = record.Ticket_Subject;
    const classification = record.Ticket_Classification;

    if (subject && classification) {
      product = `${safeStr(subject)} (${safeStr(classification)})`;
    } else {
      product = safeStr(subject || classification);
    }
  } 
  
  else if (moduleName === "Investment_leads") {
    rawMobile = safeStr(record.Mobile);
    id = safeStr(record.Lead_UCC);
    product = safeStr(record.Product_Type);
  } 
  
  else if (moduleName === "Insurance_Leads") {
    rawMobile = safeStr(record.Phone);
    id = safeStr(record.Lead_ID);
    product = safeStr(record.Product);
  }

  const cleanMobileKey = normalizePhoneNumber(rawMobile);

  return {
    data: {
      ClientName: clientName,
      ClientMobileNumber: rawMobile,
      OwnerName: ownerName,
      ID: id,
      ModuleName: moduleName,
      Product: product,
      LastActivity: record.Modified_Time // Capture for debugging if needed
    },
    key: cleanMobileKey,
  };
};

/**
 * Fetches module data (Standard API with Sort + Manual Cutoff)
 */
const fetchModuleData = async (accessToken, moduleName, legacySet) => {
  const moduleUniqueMap = new Map();

  let page = 1;
  let hasMore = true;
  let totalFetched = 0;

  const perPage = 200;
  
  // Cutoff Date Object
  const cutoffDate = getDate3MonthsAgo();

  console.log(`[${moduleName}] Fetching... Stop if Modified_Time < ${cutoffDate.toISOString()}`);

  while (hasMore) {
    try {
      // Reverted to standard List URL (removed /search)
      const url = `https://www.zohoapis.com/crm/v2/${moduleName}`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
        params: {
          page,
          per_page: perPage,
          // Sort strictly by Modified_Time Descending
          sort_by: "Modified_Time",
          sort_order: "desc",
          // Removed 'criteria' parameter completely to avoid 400 Error
        },
      });

      const data = response.data.data;
      const info = response.data.info;

      if (!data || data.length === 0) {
        break;
      }

      for (const record of data) {
        // 1. DATE CHECK: Check if record is too old
        if (record.Modified_Time) {
          const recordDate = new Date(record.Modified_Time);
          if (recordDate < cutoffDate) {
            console.log(`[${moduleName}] Reached older records (${record.Modified_Time}). Stopping.`);
            hasMore = false;
            break; // Break the for-loop
          }
        }

        // 2. Normalize
        const { data: normalizedObj, key } = normalizeRecord(
          moduleName,
          record
        );

        if (key) {
          // Filter legacy
          if (legacySet.has(key)) {
            totalFetched++;
            continue;
          }

          // Deduplicate
          if (!moduleUniqueMap.has(key)) {
            moduleUniqueMap.set(key, normalizedObj);
          }
        }

        totalFetched++;
      }

      // Break outer loop if flag was set inside for-loop
      if (!hasMore) break;

      if (info && info.more_records) {
        page++;
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`Error fetching ${moduleName}:`, error.message);
      break;
    }
  }

  const finalList = Array.from(moduleUniqueMap.values());

  console.log(`[${moduleName}] Fetch Summary:`);
  console.log(`   > Total Records Scanned: ${totalFetched}`);
  console.log(`   > Valid Unique Records: ${finalList.length}`);

  return {
    fetchedCount: totalFetched,
    uniqueCount: finalList.length,
    data: finalList,
  };
};

/**
 * Main Orchestrator
 */
export const runCrmSync = async () => {
  try {
    console.log("Starting CRM Sync (3 Months Modification Window)...");

    // Load legacy data
    const legacySet = await fetchLegacyMobiles();

    // Get token
    const accessToken = await getAccessToken();

    const modules = ["Tickets", "Investment_leads", "Insurance_Leads"];

    const consolidatedData = {};

    for (const moduleName of modules) {
      consolidatedData[moduleName] = await fetchModuleData(
        accessToken,
        moduleName,
        legacySet
      );
    }

    return consolidatedData;
  } catch (error) {
    console.error("Sync failed:", error.message);
    throw error;
  }
};