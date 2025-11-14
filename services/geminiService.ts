import { GoogleGenAI } from "@google/genai";
// Fix: Import GroundingChunk type to use in function signatures.
import type { Business, Coords, GroundingChunk } from '../types';

// Per coding guidelines, the API key must be obtained exclusively from the environment.
// Vite is configured in `vite.config.ts` to define `process.env.API_KEY`.
const apiKey = process.env.API_KEY;
if (!apiKey) {
  // This error will be thrown during app initialization if the key is missing.
  throw new Error("API_KEY environment variable not set. Please check your deployment configuration.");
}
// Fix: Use a single, shared instance of GoogleGenAI for performance and consistency.
const ai = new GoogleGenAI({ apiKey });

const parseJsonResponse = (text: string): any => {
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
        // This error will be caught by the calling function, which shows the user-facing error.
        throw new Error("The model returned data in an unexpected format.");
    }
}

export const findBusinesses = async (
  industry: string,
  keywords: string,
  location: string,
  userCoords: Coords | null,
  profileStatus: 'all' | 'claimed' | 'unclaimed',
  numberOfResults: number
// Fix: Update function signature to return businesses and grounding chunks.
): Promise<{ businesses: Business[], groundingChunks: GroundingChunk[] | undefined }> => {
  const finalPrompt = `
    Your primary and ONLY task is to return a valid JSON object. Do not add any commentary, explanation, or any text before or after the JSON object.
    The JSON object must have a single key "businesses" which is an array of business objects.

    Your top priority is to return the number of businesses requested. Return exactly ${numberOfResults} business profiles if they exist. If you cannot find that many, return as many as you can. Do not arbitrarily limit the result count.
    If you cannot find any relevant businesses, you MUST return a JSON object with an empty array, like this:
    \`\`\`json
    {
      "businesses": []
    }
    \`\`\`

    Find local businesses based on the following criteria:
    - Industry: ${industry === 'All' ? 'Any' : industry}
    - Keywords: ${keywords}
    - Location: ${location}
    ${profileStatus !== 'all' ? `- Profile Status: Only find businesses with '${profileStatus}' Google Business Profiles.` : ''}

    For each business, find the following information using Google Maps data:
    - A unique ID (you can generate this)
    - Business Name
    - Full Address
    - Phone Number (in E.164 international format, e.g., +14155552671)
    - Website URL
    - A contact email address (if you can find one, otherwise leave it null)
    - Profile Status (whether its Google Business Profile is 'claimed' or 'unclaimed'. If unknown, return 'unknown')
    
    Example of a successful response:
    \`\`\`json
    {
      "businesses": [
        {
          "id": "1",
          "name": "Example Pizza",
          "address": "123 Main St, Anytown, USA",
          "phone": "+15551234567",
          "website": "http://examplepizza.com",
          "email": "contact@examplepizza.com",
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
    
    const data = parseJsonResponse(response.text);

    const businesses = (data && data.businesses && Array.isArray(data.businesses))
      ? data.businesses.map((b: Omit<Business, 'source'>) => ({ ...b, source: 'google' }))
      : [];
    
    // Fix: Extract grounding chunks from the response as per Gemini API guidelines.
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

    return { businesses, groundingChunks };

  } catch (error) {
    console.error("Error finding businesses via Google Maps:", error);
    throw new Error("Failed to find businesses. The model response might not be valid JSON.");
  }
};

export const findBusinessesOnFacebook = async (
  industry: string,
  keywords: string,
  location: string,
  numberOfResults: number
// Fix: Update function signature to return businesses and grounding chunks.
): Promise<{ businesses: Business[], groundingChunks: GroundingChunk[] | undefined }> => {
  const finalPrompt = `
    Your task is to function as a data extraction and formatting API. You will receive a request and you MUST respond with only a valid JSON object.
    
    ## TASK
    1.  Perform a Google Search to find public Facebook Business Pages.
    2.  Use the search results (titles and snippets) to extract information about each business.
    3.  Format the extracted information into a JSON object.

    ## SEARCH CRITERIA
    -   **Industry:** "${industry === 'All' ? 'any' : industry}"
    -   **Keywords:** "${keywords}"
    -   **Location:** "${location}"
    -   **Search Query Hint:** Use a query like "official facebook page for ${keywords} ${industry} in ${location} site:facebook.com"
    -   **Number of Results:** Return exactly ${numberOfResults} businesses if found.

    ## JSON OUTPUT RULES
    -   Your entire response MUST be a single JSON object.
    -   The root object must have one key: "businesses".
    -   "businesses" must be an array of objects.
    -   If no results are found, "businesses" MUST be an empty array: \`{ "businesses": [] }\`.
    -   Do NOT include any text, comments, or markdown (like \`\`\`json\`) outside of the JSON object.

    ## DATA EXTRACTION RULES
    -   Extract data ONLY from the Google Search result titles and snippets. Do NOT invent data or assume information from the page URL.
    -   For each business, extract the following fields:
        -   **id:** A unique generated ID, prefixed with 'fb-'.
        -   **name:** The business name. This is usually clear from the search result title.
        -   **address:** The address, ONLY if it appears in the search snippet. Otherwise, null.
        -   **phone:** The phone number, ONLY if it appears in the search snippet. Otherwise, null.
        -   **website:** The official website URL (non-Facebook), ONLY if it is mentioned in the search snippet. Otherwise, null.
        -   **email:** The email address, ONLY if it appears in the search snippet. Otherwise, null.
        -   **profileStatus:** This must always be null.

    ## EXAMPLE RESPONSE
    {
      "businesses": [
        {
          "id": "fb-12345",
          "name": "Example Restaurant",
          "address": "456 Oak Ave, Sometown, USA",
          "phone": "+15559876543",
          "website": "http://examplerestaurant.com",
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
    
    const data = parseJsonResponse(response.text);
    
    const businesses = (data && data.businesses && Array.isArray(data.businesses))
      ? data.businesses.map((b: Omit<Business, 'source'>) => ({ ...b, source: 'facebook' }))
      : [];

    // Fix: Extract grounding chunks from the response as per Gemini API guidelines.
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

    return { businesses, groundingChunks };

  } catch (error) {
    console.error("Error finding businesses via Facebook:", error);
    throw new Error("Failed to find businesses from Facebook. The model returned an invalid format.");
  }
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
        return response.text;
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

        const data = parseJsonResponse(response.text);
        if (data && data.suggestions && Array.isArray(data.suggestions)) {
            return data.suggestions;
        }
        return [];

    } catch (error) {
        console.error("Error fetching location suggestions:", error);
        return []; // Return empty on error to prevent crashes
    }
};