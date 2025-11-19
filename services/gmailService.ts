
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '946355631103-sro9uveki04kjjf1d6d11jrm7vij0bbh.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/gmail.send';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const initGmailClient = async (): Promise<boolean> => {
    if (!CLIENT_ID) {
        console.warn("Google Client ID not found. Gmail integration disabled.");
        return false;
    } else {
        console.log("Initializing Gmail Client...");
        console.log("⚠️ REQUIRED ORIGIN for Google Console:", window.location.origin);
    }

    return new Promise((resolve) => {
        let attempts = 0;
        const checkScripts = setInterval(() => {
            attempts++;
            // Timeout after approx 5 seconds (50 * 100ms)
            if (attempts > 50) {
                clearInterval(checkScripts);
                console.error("Google API scripts failed to load within timeout.");
                resolve(false);
                return;
            }

            if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
                clearInterval(checkScripts);
                
                const maybeResolve = () => {
                    if (gapiInited && gisInited) {
                        resolve(true);
                    }
                };

                // Initialize GAPI
                gapi.load('client', async () => {
                    try {
                        await gapi.client.init({
                            // apiKey: API_KEY, // Optional for OAuth, handled by Token Client
                            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
                        });
                        gapiInited = true;
                        maybeResolve();
                    } catch (err) {
                        console.error("Failed to initialize GAPI client", err);
                        // Don't resolve false here immediately, let the timeout handle it or GIS try
                    }
                });

                // Initialize GIS
                try {
                    tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: CLIENT_ID,
                        scope: SCOPES,
                        callback: (resp: any) => {
                            // Callback handler
                        }, 
                    });
                    gisInited = true;
                    maybeResolve();
                } catch (err) {
                    console.error("Failed to initialize GIS client", err);
                }
            }
        }, 100);
    });
};

export const getGmailToken = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!tokenClient) return reject("Gmail client not initialized. Check console for errors.");

        tokenClient.callback = async (resp: any) => {
            if (resp.error !== undefined) {
                console.error("Auth Error:", resp);
                reject(resp);
            }
            resolve(resp);
        };

        // For implicit flow, prompt 'consent' is sometimes needed if cookies are stale or permissions changed.
        // CRITICAL FIX: Do NOT pass an empty string for prompt. Google rejects 'prompt=""' with Error 400.
        // Use undefined or 'consent'.
        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            tokenClient.requestAccessToken({}); // Pass empty object, not prompt: ''
        }
    });
};

export const sendGmail = async (to: string, subject: string, body: string) => {
    if (!gapiInited || !gisInited) {
        const initialized = await initGmailClient();
        if (!initialized) throw new Error("Could not initialize Gmail client. Check Client ID, Origin URL, or network connection.");
    }

    // Check for valid token
    if (!gapi.client.getToken()) {
        await getGmailToken();
    }

    // Create MIME message
    const utf8Subject = `=?utf-8?B?${btoa(subject)}?=`;
    const messageParts = [
        `To: ${to}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        body
    ];
    const message = messageParts.join('\n');

    // Encode to Base64URL (RFC 4648)
    const encodedMessage = btoa(unescape(encodeURIComponent(message)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    try {
        const response = await gapi.client.gmail.users.messages.send({
            'userId': 'me',
            'resource': {
                'raw': encodedMessage
            }
        });
        return response;
    } catch (error: any) {
        // If token expired, try refreshing once
        if (error.status === 401) {
             console.log("Token expired, refreshing...");
             await getGmailToken();
             // Retry sending logic
             const retryResponse = await gapi.client.gmail.users.messages.send({
                'userId': 'me',
                'resource': {
                    'raw': encodedMessage
                }
            });
            return retryResponse;
        }
        throw error;
    }
};
