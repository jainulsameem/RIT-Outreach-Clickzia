import { GoogleGenAI } from "@google/genai";
import type { Business, Coords, GroundingChunk } from '../types';

const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable not set. Please check your deployment configuration.");
}
const ai = new GoogleGenAI({ apiKey });

const parseJsonResponse = (text: string): any => {
    if (!text) return {};

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
        // Return empty object or array instead of throwing to allow partial results in loops? 
        // Better to throw so we know it failed, but in a loop we catch it.
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
  const MAX_LOOPS = 15; // Increased loops to better support deep pagination

  while (allBusinesses.length < numberOfResults && loopCount < MAX_LOOPS) {
    const remainingNeeded = numberOfResults - allBusinesses.length;
    // Use batch size of 10-20. 
    const batchSize = Math.min(remainingNeeded, 20);
    // We request a bit more to account for duplicates we filter out
    const requestCount = Math.max(5, batchSize);

    const finalPrompt = `
      Your goal is to find ${requestCount} NEW and UNIQUE business profiles that match the criteria.
      
      CRITICAL: You must return a valid JSON object. No markdown outside the JSON.
      
      Already Found / Excluded Businesses:
      ${JSON.stringify(currentExclusionList)}
      
      DO NOT include any of the above businesses in your response.
      
      Search Criteria:
      - Industry: ${industry === 'All' ? 'Any' : industry}
      - Keywords: ${keywords}
      - Location: ${location}
      ${profileStatus !== 'all' ? `- Profile Status: Only '${profileStatus}' profiles.` : ''}

      Task:
      1. Use Google Maps to find businesses in '${location}'.
      2. If you are finding duplicates from the exclusion list, try varying your search query (e.g., search in specific neighborhoods, streets, or use related keywords) to find NEW businesses on "next pages" of results.
      3. Use Google Search to find the *email address* and *website* for each business if not found on Maps.
      4. Compile the data into the JSON format.

      Output JSON Format:
      {
        "businesses": [
          {
            "id": "string (unique)",
            "name": "string",
            "address": "string",
            "phone": "string",
            "website": "string",
            "email": "string (or null)",
            "profileStatus": "claimed | unclaimed | unknown"
          }
        ]
      }
    `;

    const config: any = {
      // Enable both Maps and Search to get comprehensive data (emails) and better coverage
      tools: [{ googleMaps: {} }, { googleSearch: {} }],
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
      
      const data = parseJsonResponse(response.text || "");

      let newBusinesses = (data && data.businesses && Array.isArray(data.businesses))
        ? data.businesses.map((b: any) => ({ 
            ...b, 
            source: 'google',
            id: `gm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` 
          }))
        : [];
      
      // Filter out duplicates based on name (fuzzy match could be better but exact name is safe for now)
      newBusinesses = newBusinesses.filter((b: Business) => !currentExclusionList.includes(b.name));

      if (newBusinesses.length === 0) {
        // If we got 0 results, the model might be stuck. 
        // We can try one more time with a "Force Variation" hint in next loop, or just break.
        // For now, let's count consecutive failures? 
        // Simpler: just break if truly 0.
        if (loopCount > 0) { // allow one empty retry potentially, but usually break
             break;
        }
      }

      allBusinesses = [...allBusinesses, ...newBusinesses];
      currentExclusionList = [...currentExclusionList, ...newBusinesses.map((b: Business) => b.name)];
      
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        allGroundingChunks = [...allGroundingChunks, ...chunks];
      }
      
      // Small delay to be nice to API limits if needed, but await is usually enough.

    } catch (error) {
      console.error(`Error in search iteration ${loopCount}:`, error);
      // If we have some businesses, return them. If early error, throw? 
      // Best to just break and return what we have.
      break;
    }

    loopCount++;
  }

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
  const MAX_LOOPS = 15;

  while (allBusinesses.length < numberOfResults && loopCount < MAX_LOOPS) {
    const remainingNeeded = numberOfResults - allBusinesses.length;
    const batchSize = Math.min(remainingNeeded, 20);
    const requestCount = Math.max(5, batchSize);

    const finalPrompt = `
      Task: Find ${requestCount} NEW business profiles on Facebook.
      
      Search:
      - Industry: ${industry === 'All' ? 'any' : industry}
      - Keywords: ${keywords}
      - Location: ${location}
      - Query: "facebook page ${keywords} ${industry} ${location}" or similar.

      Exclusions:
      ${JSON.stringify(currentExclusionList)}
      
      Instructions:
      1. Find public Facebook business pages.
      2. Extract Business Name, Address, Phone, Website, and Email.
      3. Prioritize finding an EMAIL address from the page snippets.
      4. Return valid JSON.

      Output:
      {
        "businesses": [
          {
            "id": "fb-...",
            "name": "...",
            "address": "...",
            "phone": "...",
            "website": "...",
            "email": "...",
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
      
      const data = parseJsonResponse(response.text || "");
      
      let newBusinesses = (data && data.businesses && Array.isArray(data.businesses))
        ? data.businesses.map((b: any) => ({ 
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

        const data = parseJsonResponse(response.text || "");
        if (data && data.suggestions && Array.isArray(data.suggestions)) {
            return data.suggestions;
        }
        return [];

    } catch (error) {
        console.error("Error fetching location suggestions:", error);
        return []; 
    }
};
