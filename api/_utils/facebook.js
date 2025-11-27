
import axios from 'axios';

const FB_VERSION = process.env.FB_GRAPH_VERSION || 'v18.0';
const RETRY_LIMIT = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches lead details from Facebook Graph API.
 * 
 * @param {string} leadgenId - The ID of the lead entry.
 * @param {string} accessToken - The Page Access Token associated with the form/page.
 */
export async function fetchLeadDetails(leadgenId, accessToken) {
  if (!accessToken) throw new Error("Access Token is required to fetch lead details.");

  const url = `https://graph.facebook.com/${FB_VERSION}/${leadgenId}?access_token=${accessToken}`;

  let attempt = 0;
  while (attempt < RETRY_LIMIT) {
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      attempt++;
      console.error(`[FB API Error] Attempt ${attempt} failed for Lead ID ${leadgenId}: ${error.message}`);
      
      if (attempt >= RETRY_LIMIT) throw error;
      
      // Exponential backoff
      await sleep(1000 * Math.pow(2, attempt - 1));
    }
  }
}

/**
 * Maps raw Facebook field_data to canonical columns.
 * 
 * @param {Object} graphResponse - The raw JSON from Facebook Graph API
 * @param {Object} fieldMapping - Key-value pair { fbField: crmField } from DB
 */
export function normalizeLeadData(graphResponse, fieldMapping = {}) {
  const { field_data, created_time, id } = graphResponse;
  
  // Base Object
  const normalized = {
    leadgen_id: id,
    lead_created_time: created_time,
    full_name: null,
    email: null,
    phone_number: null,
    raw_payload: graphResponse,
  };

  if (Array.isArray(field_data)) {
    field_data.forEach((field) => {
      const fieldName = field.name; // The key from Facebook (e.g. "budget_question")
      const fieldValue = field.values && field.values[0];

      if (!fieldValue) return;

      // 1. Check for Explicit Mapping
      const mappedCrmField = fieldMapping[fieldName];
      
      if (mappedCrmField) {
          switch (mappedCrmField) {
              case 'name': normalized.full_name = fieldValue; break;
              case 'email': normalized.email = fieldValue; break;
              case 'phone': normalized.phone_number = fieldValue; break;
              case 'address': 
                  if (!normalized.raw_payload.mapped_extras) normalized.raw_payload.mapped_extras = {};
                  normalized.raw_payload.mapped_extras['address'] = fieldValue; 
                  break;
              case 'website':
                  if (!normalized.raw_payload.mapped_extras) normalized.raw_payload.mapped_extras = {};
                  normalized.raw_payload.mapped_extras['website'] = fieldValue;
                  break;
              case 'customSourceDetails':
                  if (!normalized.raw_payload.mapped_extras) normalized.raw_payload.mapped_extras = {};
                  normalized.raw_payload.mapped_extras['customSourceDetails'] = fieldValue;
                  break;
          }
          return; // Skip heuristics
      }

      // 2. Default Heuristics (Fallback)
      const lowerName = fieldName.toLowerCase();
      if (lowerName.includes('email')) {
        normalized.email = fieldValue;
      } else if (lowerName.includes('phone') || lowerName.includes('number')) {
        normalized.phone_number = fieldValue;
      } else if ((lowerName.includes('name') || lowerName.includes('full name')) && !lowerName.includes('campaign')) {
        normalized.full_name = fieldValue;
      }
    });
  }

  return normalized;
}
