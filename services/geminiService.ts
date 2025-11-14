import { GoogleGenAI } from "@google/genai";
import type { Business, Coords } from '../types';

// FIX: Per coding guidelines, API key must come from process.env.API_KEY and be used directly.
// This also resolves the TypeScript error on `import.meta.env`.
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const parseJsonResponse = (text: string): any => {
    // Attempt to extract JSON from markdown code block first
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonString = jsonMatch ? jsonMatch[1] : text;
    
    // Fallback for cases where the model doesn't use markdown
    if (!jsonString.startsWith('{') && jsonString.indexOf('{') > -1) {
      jsonString = jsonString.substring(jsonString.indexOf('{'), jsonString.lastIndexOf('}') + 1);
    }
    
    if (!jsonString) {
        throw new Error("No JSON object found in the response.");
    }

    return JSON.parse(jsonString);
}

export const findBusinesses = async (
  industry: string,
  keywords: string,
  location: string,
  userCoords: Coords | null,
  profileStatus: 'all' | 'claimed' | 'unclaimed',
  numberOfResults: number
): Promise<Business[]> => {
  const ai = getAi();

  const finalPrompt = `
    Your top priority is to return the number of businesses requested. Return exactly ${numberOfResults} business profiles if they exist. If you cannot find that many, return as many as you can. Do not arbitrarily limit the result count.

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
    
    Return the information as a valid JSON object with a single key "businesses" which is an array of business objects. For example:
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

    if (data && data.businesses && Array.isArray(data.businesses)) {
        return data.businesses.map((b: Omit<Business, 'source'>) => ({ ...b, source: 'google' }));
    }
    return [];

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
): Promise<Business[]> => {
  const ai = getAi();
  
  const finalPrompt = `
    Your primary and ONLY task is to return a valid JSON object. Do not add any commentary, explanation, or any text before or after the JSON object.
    The JSON object must have a single key "businesses" which is an array of business objects.
    
    To populate this array, perform a Google Search to find public Facebook Business Pages matching these criteria:
    - Search Query Context: Find "${keywords}" in the "${industry === 'All' ? 'any' : industry}" category near "${location}".
    - Your Google Search query must be restricted to Facebook pages. For example, use a query like: "official facebook page for ${keywords} ${industry} in ${location} site:facebook.com"
    - Focus on official business pages, not personal profiles, groups, or event pages.
    - The user requires exactly ${numberOfResults} business results. It is critical that you provide this many results if they exist. Do not arbitrarily limit the result set to a smaller number.

    From each relevant Facebook Business Page found in the search results, carefully extract the following information. Look for this data primarily in the page's 'About' section:
    - id: A unique generated ID, prefixed with 'fb-'.
    - name: The Business Name as it appears on the page.
    - address: The full physical address, if publicly listed. If not found, return null.
    - phone: The phone number, if publicly listed. If not found, return null.
    - website: The official business website URL. This should NOT be a facebook.com URL. If a non-Facebook website is not listed in the 'About' section, return null.
    - email: The contact email address. This is often hard to find. If it's not explicitly listed, return null. Do not guess or create an email address.
    - profileStatus: This should always be null for Facebook results.

    Example of a successful response:
    \`\`\`json
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
    \`\`\`
    
    If you cannot find any relevant businesses, you MUST return a JSON object with an empty array, like this:
    \`\`\`json
    {
      "businesses": []
    }
    \`\`\`
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
    
    if (data && data.businesses && Array.isArray(data.businesses)) {
        return data.businesses.map((b: Omit<Business, 'source'>) => ({ ...b, source: 'facebook' }));
    }
    return [];

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
    const ai = getAi();
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
    const ai = getAi();
    
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