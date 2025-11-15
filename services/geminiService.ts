import { GoogleGenAI } from "@google/genai";
import type { Business, Coords, GroundingChunk } from '../types';

const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable not set. Please check your deployment configuration.");
}
const ai = new GoogleGenAI({ apiKey });

const parseJsonResponse = (text: string): any => {
    if (!text) return {}; // Fix: Handle empty text case

    // Attempt to extract JSON from markdown code block first
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonString = text;
    
    if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
    } else {
        // Fallback: find the first '{' or '[' and the last '}' or ']'
        const firstBracket = text.indexOf('[');
        const firstBrace = text.indexOf('{');

        let start = -1;
        if (firstBracket > -1 && firstBrace > -1) {
            start = Math.min(firstBracket, firstBrace);
        } else if (firstBracket > -1) {
            start = firstBracket;
        } else {
            start = firstBrace;
        }

        const lastBracket = text.lastIndexOf(']');
        const lastBrace = text.lastIndexOf('}');

        let end = -1;
        if (lastBracket > -1 && lastBrace > -1) {
            end = Math.max(lastBracket, lastBrace);
        } else if (lastBracket > -1) {
            end = lastBracket;
        } else {
            end = lastBrace;
        }
        
        if (start !== -1 && end !== -1 && end > start) {
            jsonString = text.substring(start, end + 1);
        }
    }
    
    try {
        return JSON.parse(jsonString.trim());
    } catch (error) {
        console.error("Failed to parse JSON string. Content was:", `>>>${jsonString}<<<`);
        console.error("Original model response was:", `>>>${text}<<<`);
        throw new Error("The model returned data in an unexpected format.");
    }
}

export const findBusinesses = async (
  industry: string,
  keywords: string,
  location: string,
  userCoords: Coords | null,
  profileStatus: 'all' | 'claimed' | 'unclaimed',
  numberOfResults: number,
  existingBusinessNames: string[] = []
): Promise<{ businesses: Business[], groundingChunks: GroundingChunk[] | undefined }> => {
  
  let allBusinesses: Business[] = [];
  let allGroundingChunks: GroundingChunk[] = [];
  let currentExclusionList = [...existingBusinessNames];
  let loopCount = 0;
  const MAX_LOOPS = 10; // Limit iterations to prevent infinite loops (supports up to ~200 results)

  while (allBusinesses.length < numberOfResults && loopCount < MAX_LOOPS) {
    const remainingNeeded = numberOfResults - allBusinesses.length;
    // We limit the batch size to 20 because tool calls (Maps) typically return max 20 results per query.
    // Requesting more often leads to duplicates or hallucinations.
    const batchSize = Math.min(remainingNeeded, 20);
    
    // If we only need a few more, we still ask for at least 5 to ensure we get something back after filtering.
    const requestCount = Math.max(5, batchSize);

    const finalPrompt = `
      Your primary and ONLY task is to return a valid JSON object. Do not add any commentary.
      The JSON object must have a single key "businesses" which is an array of business objects.

      Your goal is to find ${requestCount} NEW business profiles that match the criteria.

      ${currentExclusionList.length > 0 ? `CRITICAL: You MUST exclude the following businesses from your results as they have already been found: ${JSON.stringify(currentExclusionList)}.` : ''}

      If you cannot find any NEW relevant businesses, return a JSON object with an empty array.

      Find local businesses based on:
      - Industry: ${industry === 'All' ? 'Any' : industry}
      - Keywords: ${keywords}
      - Location: ${location}
      ${profileStatus !== 'all' ? `- Profile Status: Only find businesses with '${profileStatus}' Google Business Profiles.` : ''}

      For each business, find the following information using Google Maps data:
      - A unique ID (generate this)
      - Business Name
      - Full Address
      - Phone Number (E.164 format)
      - Website URL
      - Email (if available, else null)
      - Profile Status ('claimed', 'unclaimed', or 'unknown')
      
      Example JSON output:
      \`\`\`json
      {
        "businesses": [
          {
            "id": "1",
            "name": "Example Business",
            "address": "123 Main St",
            "phone": "+15551234567",
            "website": "http://example.com",
            "email": "contact@example.com",
            "profileStatus": "claimed"
          }
        ]
      }
      \`\`\`
    `;

    const config: any = {
      tools: [{ googleMaps: {} }],
    };

    if (userCoords) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: userCoords.latitude,
            longitude: userCoords.longitude,
          }
        }
      };
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: finalPrompt,
        config,
      });
      
      // Fix: Handle potentially undefined response.text
      const data = parseJsonResponse(response.text || "");

      // Process new businesses
      let newBusinesses = (data && data.businesses && Array.isArray(data.businesses))
        ? data.businesses.map((b: Omit<Business, 'source'>) => ({ 
            ...b, 
            source: 'google',
            // Ensure ID is unique for React lists
            id: `gm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` 
          }))
        : [];
      
      // Strict client-side filtering to ensure no duplicates from the exclusion list
      newBusinesses = newBusinesses.filter((b: Business) => !currentExclusionList.includes(b.name));

      if (newBusinesses.length === 0) {
        // If the model returned 0 new businesses, we've likely exhausted the search results.
        break;
      }

      allBusinesses = [...allBusinesses, ...newBusinesses];
      currentExclusionList = [...currentExclusionList, ...newBusinesses.map((b: Business) => b.name)];
      
      // Accumulate grounding chunks
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        allGroundingChunks = [...allGroundingChunks, ...chunks];
      }

    } catch (error) {
      console.error(`Error in search iteration ${loopCount}:`, error);
      // If an iteration fails, stop and return what we have so far
      break;
    }

    loopCount++;
  }

  // Return only the requested number, though we might have fetched slightly more
  return { businesses: allBusinesses.slice(0, numberOfResults), groundingChunks: allGroundingChunks };
};

export const findBusinessesOnFacebook = async (
  industry: string,
  keywords: string,
  location: string,
  numberOfResults: number,
  existingBusinessNames: string[] = []
): Promise<{ businesses: Business[], groundingChunks: GroundingChunk[] | undefined }> => {
  
  let allBusinesses: Business[] = [];
  let allGroundingChunks: GroundingChunk[] = [];
  let currentExclusionList = [...existingBusinessNames];
  let loopCount = 0;
  const MAX_LOOPS = 10;

  while (allBusinesses.length < numberOfResults && loopCount < MAX_LOOPS) {
    const remainingNeeded = numberOfResults - allBusinesses.length;
    const batchSize = Math.min(remainingNeeded, 20);
    const requestCount = Math.max(5, batchSize);

    const finalPrompt = `
      Your task is to function as a data extraction and formatting API. You will receive a request and you MUST respond with only a valid JSON object.
      
      ## TASK
      1.  Perform a Google Search to find public Facebook Business Pages.
      2.  Extract information about each business.
      3.  Return ${requestCount} NEW businesses.

      ## SEARCH CRITERIA
      -   **Industry:** "${industry === 'All' ? 'any' : industry}"
      -   **Keywords:** "${keywords}"
      -   **Location:** "${location}"
      -   **Search Query Hint:** Use a query like "official facebook page for ${keywords} ${industry} in ${location} site:facebook.com"

      ${currentExclusionList.length > 0 ? `## EXCLUSION RULE\n- CRITICAL: You MUST exclude the following businesses: ${JSON.stringify(currentExclusionList)}.` : ''}

      ## JSON OUTPUT RULES
      -   Root object key: "businesses" (array).
      -   If no *new* results found, return empty array.

      ## DATA EXTRACTION
      -   **id:** Generate unique ID.
      -   **name:** Business name.
      -   **address:** Address from snippet (or null).
      -   **phone:** Phone from snippet (or null).
      -   **website:** Official website from snippet (or null).
      -   **email:** Email from snippet (or null).
      -   **profileStatus:** null.

      ## EXAMPLE RESPONSE
      {
        "businesses": [
          {
            "id": "fb-12345",
            "name": "Example Restaurant",
            "address": "456 Oak Ave",
            "phone": "+15559876543",
            "website": "http://example.com",
            "email": null,
            "profileStatus": null
          }
        ]
      }
      `;
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: finalPrompt,
        config: {
          tools: [{googleSearch: {}}],
        },
      });
      
      // Fix: Handle potentially undefined response.text
      const data = parseJsonResponse(response.text || "");
      
      let newBusinesses = (data && data.businesses && Array.isArray(data.businesses))
        ? data.businesses.map((b: Omit<Business, 'source'>) => ({ 
            ...b, 
            source: 'facebook',
            id: `fb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          }))
        : [];
      
      newBusinesses = newBusinesses.filter((b: Business) => !currentExclusionList.includes(b.name));

      if (newBusinesses.length === 0) break;

      allBusinesses = [...allBusinesses, ...newBusinesses];
      currentExclusionList = [...currentExclusionList, ...newBusinesses.map((b: Business) => b.name)];

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        allGroundingChunks = [...allGroundingChunks, ...chunks];
      }

    } catch (error) {
      console.error(`Error in Facebook search iteration ${loopCount}:`, error);
      break;
    }

    loopCount++;
  }

  return { businesses: allBusinesses.slice(0, numberOfResults), groundingChunks: allGroundingChunks };
};


export const generateColdEmail = async (
  businessName: string,
  fromName: string,
  outreachTopic: string
): Promise<string> => {
    const prompt = `
      Write a professional and concise cold outreach email.
      The email is from: ${fromName}.
      The email is to: The owner/manager of ${businessName}.
      The topic of the outreach is: ${outreachTopic}.
      
      Keep the email short, personalized, and focused on providing value to the business.
      Start by acknowledging something specific about their business if possible (though you can make a generic compliment).
      End with a clear call to action.
      Do not include a subject line or your own signature, just the body of the email.
    `;

    try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });
        // Fix: Handle potentially undefined response.text
        return response.text || "";
    } catch (error) {
        console.error("Error generating email:", error);
        throw new Error("Failed to generate email content.");
    }
};

export const getLocationSuggestions = async (query: string): Promise<string[]> => {
    if (query.trim().length < 3) return [];
    
    const prompt = `
        Based on the search query "${query}", provide up to 5 relevant location name suggestions.
        Your response MUST be a valid JSON object with a single key "suggestions", which is an array of strings.
        For example: { "suggestions": ["New York, NY, USA", "New York, England", "York, PA, USA"] }.
        Do not add any other text or explanation. If you find no suggestions, return an empty array.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleMaps: {} }],
            },
        });

        // Fix: Handle potentially undefined response.text
        const data = parseJsonResponse(response.text || "");
        if (data && data.suggestions && Array.isArray(data.suggestions)) {
            return data.suggestions;
        }
        return [];

    } catch (error) {
        console.error("Error fetching location suggestions:", error);
        return []; // Return empty on error to prevent crashes
    }
};