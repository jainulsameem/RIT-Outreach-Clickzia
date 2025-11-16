import { GoogleGenAI } from "@google/genai";
import type { Business, Coords, GroundingChunk } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
        // Return empty object instead of throwing to prevent crashing the whole loop
        return { businesses: [] };
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
  const MAX_LOOPS = 15; 

  while (allBusinesses.length < numberOfResults && loopCount < MAX_LOOPS) {
    const remainingNeeded = numberOfResults - allBusinesses.length;
    // Keep batch size manageable for the model
    const batchSize = Math.min(remainingNeeded, 20);
    const requestCount = Math.max(5, batchSize);

    // Dynamic instruction to force the model to look "deeper" in subsequent loops
    const variationInstruction = loopCount === 0 
        ? `Search broadly in '${location}'.` 
        : `CRITICAL PAGINATION STRATEGY: You have already found the top results. To find ${requestCount} NEW businesses, you MUST vary your search query. Search in specific **neighborhoods**, **streets**, or **adjacent areas** within '${location}'. Do NOT repeat the general search.`;

    const finalPrompt = `
      Task: Find ${requestCount} NEW and UNIQUE business profiles.
      
      CONTEXT:
      We are compiling a comprehensive list.
      ALREADY FOUND / EXCLUDED (Do NOT return these):
      ${JSON.stringify(currentExclusionList)}
      
      SEARCH PARAMETERS:
      - Industry: ${industry === 'All' ? 'Any' : industry}
      - Keywords: ${keywords}
      - Location: ${location}
      ${profileStatus !== 'all' ? `- Profile Status: Only '${profileStatus}' profiles.` : ''}

      INSTRUCTIONS:
      1. **Smart Search**: ${variationInstruction}
      2. **Data Extraction (CRITICAL)**:
         - **Website**: You MUST prioritize extracting the official 'website' field from the Google Maps result. This is the business's own URL (e.g., 'www.pizzaplace.com'). 
           - If the Maps result has a website, USE IT.
           - If Maps has NO website, use Google Search to find it: query "${keywords} ${location} official website".
           - Do NOT return a 'google.com/maps/...' link as the website.
         - **Email**: Google Maps rarely lists emails. You MUST use Google Search to find an email address. Query: "${keywords} ${location} email contact" or "contact us".
      3. **Profile Status**: If using Google Maps, check if the business is claimed.
      4. **Format**: Return a valid JSON object.

      Output JSON Format:
      {
        "businesses": [
          {
            "id": "string (unique)",
            "name": "string",
            "address": "string",
            "phone": "string",
            "website": "string (The business's own URL)",
            "email": "string (or null)",
            "profileStatus": "claimed | unclaimed | unknown"
          }
        ]
      }
    `;

    const config: any = {
      // Enable both Maps and Search for maximum data coverage
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
      
      // Strict filtering of duplicates
      newBusinesses = newBusinesses.filter((b: Business) => !currentExclusionList.includes(b.name));

      if (newBusinesses.length === 0) {
        // If we found nothing new, and we've tried a few times, maybe stop.
        // But often the model just needs a nudge. 
        if (loopCount > 2 && newBusinesses.length === 0) break;
      }

      allBusinesses = [...allBusinesses, ...newBusinesses];
      currentExclusionList = [...currentExclusionList, ...newBusinesses.map((b: Business) => b.name)];
      
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        allGroundingChunks = [...allGroundingChunks, ...(chunks as unknown as GroundingChunk[])];
      }

    } catch (error) {
      console.error(`Error in search iteration ${loopCount}:`, error);
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

    const variationInstruction = loopCount === 0
      ? `Find public Facebook business pages in '${location}'.`
      : `You have already found the top results. Vary your search query to find NEW results (e.g. different keywords or specific sub-locations in '${location}').`;

    const finalPrompt = `
      Task: Find ${requestCount} NEW business profiles on Facebook.
      
      ALREADY FOUND / EXCLUDED:
      ${JSON.stringify(currentExclusionList)}
      
      Search:
      - Industry: ${industry === 'All' ? 'any' : industry}
      - Keywords: ${keywords}
      - Location: ${location}
      
      Instructions:
      1. ${variationInstruction}
      2. Extract Business Name, Address, Phone, Website, and Email.
      3. **Email Priority**: Specifically look for the 'About' section or 'Contact' details on the Facebook page snippets to find an EMAIL address.
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

      if (newBusinesses.length === 0 && loopCount > 2) break;

      allBusinesses = [...allBusinesses, ...newBusinesses];
      currentExclusionList = [...currentExclusionList, ...newBusinesses.map((b: Business) => b.name)];

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        allGroundingChunks = [...allGroundingChunks, ...(chunks as unknown as GroundingChunk[])];
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