
import { GoogleGenAI } from "@google/genai";
import type { Business, Coords, GroundingChunk } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const parseJsonResponse = (text: string): any => {
    if (!text) return {};

    // 1. Try extraction from Markdown code blocks
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        try {
            return JSON.parse(jsonMatch[1].trim());
        } catch (e) {
            console.warn("Failed to parse JSON from code block, trying loose parsing.");
        }
    }

    // 2. Try finding the outer-most object or array structure
    let jsonString = text;
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
         jsonString = text.substring(firstBrace, lastBrace + 1);
         try {
            return JSON.parse(jsonString);
         } catch (e) {
            // continue to next strategy
         }
    }

    // 3. Fallback: The model might have returned just the array property value without the key
    // or invalid trailing commas. This is a best-effort cleanup.
    try {
        // Sometimes model returns [ { ... } ] directly without "businesses" key
        const firstSquare = text.indexOf('[');
        const lastSquare = text.lastIndexOf(']');
        if (firstSquare !== -1 && lastSquare !== -1 && lastSquare > firstSquare) {
            const potentialArray = text.substring(firstSquare, lastSquare + 1);
            const parsedArray = JSON.parse(potentialArray);
            if (Array.isArray(parsedArray)) {
                return { businesses: parsedArray };
            }
        }
    } catch (e) {
        console.error("All JSON parsing strategies failed for text:", text.substring(0, 100) + "...");
    }

    return { businesses: [] };
}

export const findBusinesses = async (
  industry: string,
  keywords: string,
  location: string,
  userCoords: Coords | null,
  profileStatus: 'all' | 'claimed' | 'unclaimed',
  numberOfResults: number,
  existingBusinessNames: string[] = [],
  onBatchLoaded?: (businesses: Business[], groundingChunks: GroundingChunk[]) => void
): Promise<{ businesses: Business[], groundingChunks: GroundingChunk[] | undefined }> => {
  
  let allBusinesses: Business[] = [];
  let allGroundingChunks: GroundingChunk[] = [];
  let currentExclusionList = [...existingBusinessNames];
  let loopCount = 0;
  const MAX_LOOPS = 8; // Reduced from 15 to prevent excessive waits

  while (allBusinesses.length < numberOfResults && loopCount < MAX_LOOPS) {
    const remainingNeeded = numberOfResults - allBusinesses.length;
    // Request slightly more than needed to account for duplicates/filtering
    const batchSize = Math.min(remainingNeeded + 2, 20);
    const requestCount = Math.max(5, batchSize);

    const variationInstruction = loopCount === 0 
        ? `Search broadly in '${location}'.` 
        : `CRITICAL: You have already found the top results. To find ${requestCount} NEW businesses, you MUST vary your search query. Search in specific **neighborhoods**, **streets**, or **adjacent areas** within '${location}' that you haven't checked yet.`;

    const finalPrompt = `
      Task: Find ${requestCount} NEW and UNIQUE business profiles.
      
      CONTEXT:
      We are compiling a list of local businesses.
      ALREADY FOUND / EXCLUDED (Do NOT return these):
      ${JSON.stringify(currentExclusionList.slice(-50))}
      
      SEARCH PARAMETERS:
      - Industry: ${industry === 'All' ? 'Any' : industry}
      - Keywords: ${keywords}
      - Location: ${location}
      ${profileStatus !== 'all' ? `- Profile Status: Only '${profileStatus}' profiles.` : ''}

      INSTRUCTIONS:
      1. **Smart Search**: ${variationInstruction}
      2. **Data Extraction**:
         - **Website**: Extract the official business website (e.g., 'pizzaplace.com'). Use Google Search if Maps doesn't have it. Do NOT use 'google.com/maps/...' links.
         - **Email**: Use Google Search to find an email address (look for "contact", "about", or facebook pages in search results).
      3. **Format**: Return ONLY valid JSON. No markdown, no conversational text.
      
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
      
      // Strict filtering of duplicates based on name
      newBusinesses = newBusinesses.filter((b: Business) => !currentExclusionList.includes(b.name));

      if (newBusinesses.length > 0) {
          allBusinesses = [...allBusinesses, ...newBusinesses];
          currentExclusionList = [...currentExclusionList, ...newBusinesses.map((b: Business) => b.name)];
          
          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as unknown as GroundingChunk[];
          if (chunks) {
            allGroundingChunks = [...allGroundingChunks, ...chunks];
          }
          
          // PROGRESSIVE UPDATE: Notify UI immediately
          if (onBatchLoaded) {
              onBatchLoaded(newBusinesses, chunks || []);
          }
      } else {
           // If we found nothing new, likely we've exhausted obvious results or model is looping.
           if (loopCount > 3) break;
      }

    } catch (error) {
      console.error(`Error in search iteration ${loopCount}:`, error);
      // Don't break immediately, try one more loop potentially
      if (loopCount > 5) break;
    }

    loopCount++;
  }

  return { businesses: allBusinesses, groundingChunks: allGroundingChunks };
};

export const findBusinessesOnFacebook = async (
  industry: string,
  keywords: string,
  location: string,
  numberOfResults: number,
  existingBusinessNames: string[] = [],
  onBatchLoaded?: (businesses: Business[], groundingChunks: GroundingChunk[]) => void
): Promise<{ businesses: Business[], groundingChunks: GroundingChunk[] | undefined }> => {
  
  let allBusinesses: Business[] = [];
  let allGroundingChunks: GroundingChunk[] = [];
  let currentExclusionList = [...existingBusinessNames];
  let loopCount = 0;
  const MAX_LOOPS = 8;

  while (allBusinesses.length < numberOfResults && loopCount < MAX_LOOPS) {
    const remainingNeeded = numberOfResults - allBusinesses.length;
    const batchSize = Math.min(remainingNeeded + 2, 20);
    const requestCount = Math.max(5, batchSize);

    const variationInstruction = loopCount === 0
      ? `Find public Facebook business pages in '${location}'.`
      : `Vary your search query to find NEW results (e.g. specific sub-locations in '${location}').`;

    const finalPrompt = `
      Task: Find ${requestCount} NEW business profiles on Facebook.
      
      ALREADY FOUND / EXCLUDED:
      ${JSON.stringify(currentExclusionList.slice(-50))}
      
      Search:
      - Industry: ${industry === 'All' ? 'any' : industry}
      - Keywords: ${keywords}
      - Location: ${location}
      
      Instructions:
      1. ${variationInstruction}
      2. Extract details. Look for 'About' or 'Contact' sections to find EMAILS.
      3. Return ONLY valid JSON.
      
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

      if (newBusinesses.length > 0) {
        allBusinesses = [...allBusinesses, ...newBusinesses];
        currentExclusionList = [...currentExclusionList, ...newBusinesses.map((b: Business) => b.name)];

        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as unknown as GroundingChunk[];
        if (chunks) {
            allGroundingChunks = [...allGroundingChunks, ...chunks];
        }

        // PROGRESSIVE UPDATE
        if (onBatchLoaded) {
            onBatchLoaded(newBusinesses, chunks || []);
        }
      } else {
        if (loopCount > 3) break;
      }

    } catch (error) {
      console.error(`Error in Facebook search iteration ${loopCount}:`, error);
      break;
    }

    loopCount++;
  }

  return { businesses: allBusinesses, groundingChunks: allGroundingChunks };
};

export const findDecisionMakers = async (
  industry: string,
  keywords: string,
  location: string,
  numberOfResults: number,
  existingNames: string[] = [],
  onBatchLoaded?: (businesses: Business[], groundingChunks: GroundingChunk[]) => void
): Promise<{ businesses: Business[], groundingChunks: GroundingChunk[] | undefined }> => {
    
  let allProfiles: Business[] = [];
  let allGroundingChunks: GroundingChunk[] = [];
  let currentExclusionList = [...existingNames];
  let loopCount = 0;
  const MAX_LOOPS = 8;

  while (allProfiles.length < numberOfResults && loopCount < MAX_LOOPS) {
    const remainingNeeded = numberOfResults - allProfiles.length;
    const requestCount = Math.max(5, Math.min(remainingNeeded + 2, 15));

    const variationInstruction = loopCount === 0
      ? `Search for decision makers in '${location}'.`
      : `Vary your search. Look for different job titles (e.g., 'Director', 'Partner', 'Manager') or specific sub-industries in '${location}' to find NEW people.`;

    // Specific prompt to target LinkedIn profiles via Google Search grounding
    const finalPrompt = `
      Task: Find ${requestCount} NEW LinkedIn profiles for decision makers (CEO, Founder, Owner, Director, Partner).
      
      Target:
      - Industry/Niche: ${industry === 'All' ? 'Any Business' : industry}
      - Location: ${location}
      - Keywords: ${keywords} (use these to find specific companies or roles)
      
      Already Found (Exclude): ${JSON.stringify(currentExclusionList.slice(-50))}
      
      Instructions:
      1. ${variationInstruction}
      2. Use Google Search to find "site:linkedin.com/in" results matching the criteria.
      3. Extract the following details for each person:
         - Name
         - Job Title (Role)
         - Company Name
         - LinkedIn Profile URL
         - Estimated Location/Address from profile
      4. Return ONLY valid JSON.
      
      Output Format:
      {
        "businesses": [
          {
            "id": "li-...",
            "name": "Company Name",
            "contactName": "Person Name",
            "contactRole": "Job Title",
            "linkedinUrl": "https://linkedin.com/in/...",
            "address": "City, State",
            "phone": null,
            "email": null,
            "website": null
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
      
      let newProfiles = (data && data.businesses && Array.isArray(data.businesses))
        ? data.businesses.map((b: any) => ({ 
            ...b, 
            source: 'linkedin',
            id: `li-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          }))
        : [];
      
      // Filter duplicates based on contact name + company to be unique
      newProfiles = newProfiles.filter((b: Business) => {
         const uniqueKey = `${b.contactName}-${b.name}`;
         if (currentExclusionList.includes(uniqueKey)) return false;
         return true;
      });

      if (newProfiles.length > 0) {
        allProfiles = [...allProfiles, ...newProfiles];
        currentExclusionList = [...currentExclusionList, ...newProfiles.map((b: Business) => `${b.contactName}-${b.name}`)];

        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as unknown as GroundingChunk[];
        if (chunks) {
            allGroundingChunks = [...allGroundingChunks, ...chunks];
        }

        if (onBatchLoaded) {
            onBatchLoaded(newProfiles, chunks || []);
        }
      } else {
        if (loopCount > 3) break;
      }

    } catch (error) {
      console.error(`Error in LinkedIn search iteration ${loopCount}:`, error);
      break;
    }
    loopCount++;
  }

  return { businesses: allProfiles, groundingChunks: allGroundingChunks };
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
        Do not add any other text or explanation.
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
