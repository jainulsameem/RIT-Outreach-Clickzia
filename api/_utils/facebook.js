import axios from 'axios';

const FB_VERSION = process.env.FB_GRAPH_VERSION || 'v18.0';
const RETRY_LIMIT = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchLeadDetails(leadgenId) {
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!accessToken) throw new Error("FB_PAGE_ACCESS_TOKEN is missing");

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

export function normalizeLeadData(graphResponse) {
  const { field_data, created_time, id } = graphResponse;
  
  const normalized = {
    leadgen_id: id,
    lead_created_time: created_time,
    full_name: null,
    email: null,
    phone_number: null,
    raw_payload: graphResponse
  };

  if (Array.isArray(field_data)) {
    field_data.forEach((field) => {
      const name = field.name.toLowerCase();
      const value = field.values && field.values[0];

      if (!value) return;

      if (name.includes('email')) {
        normalized.email = value;
      } else if (name.includes('phone') || name.includes('number')) {
        normalized.phone_number = value;
      } else if ((name.includes('name') || name.includes('full name')) && !name.includes('campaign')) {
        normalized.full_name = value;
      }
    });
  }

  return normalized;
}