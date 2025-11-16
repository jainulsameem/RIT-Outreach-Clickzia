
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/gmail.send';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const initGmailClient = async (): Promise<boolean> => {
    if (!CLIENT_ID) {
        console.warn("Google Client ID not found. Gmail integration disabled.");
        return false;
    } else {
        console.log("Initializing Gmail Client with ID ending in...", CLIENT_ID.slice(-10));
    }

    return new Promise((resolve) => {
        const checkScripts = setInterval(() => {
            if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
                clearInterval(checkScripts);
                
                // Initialize GAPI
                gapi.load('client', async () => {
                    await gapi.client.init({
                        // apiKey: API_KEY, // specific API key not strictly needed for OAuth calls if sending token, but helpful for discovery
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
                    });
                    gapiInited = true;
                    maybeResolve();
                });

                // Initialize GIS
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: '', // defined at request time
                });
                gisInited = true;
                maybeResolve();
            }
        }, 100);

        const maybeResolve = () => {
            if (gapiInited && gisInited) {
                resolve(true);
            }
        };
    });
};

export const getGmailToken = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!tokenClient) return reject("Gmail client not initialized");

        tokenClient.callback = async (resp: any) => {
            if (resp.error !== undefined) {
                reject(resp);
            }
            resolve(resp);
        };

        if (gapi.client.getToken() === null) {
            // Prompt the user to select a Google Account and ask for consent to share their data
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            // Skip display of account chooser and consent dialog for an existing session.
            tokenClient.requestAccessToken({ prompt: '' });
        }
    });
};

export const sendGmail = async (to: string, subject: string, body: string) => {
    if (!gapiInited || !gisInited) {
        const initialized = await initGmailClient();
        if (!initialized) throw new Error("Could not initialize Gmail client. Check Client ID.");
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
             await getGmailToken();
             // Retry sending logic could go here, but for now simply prompting user to click send again is safer to avoid loops
             throw new Error("Token expired. Re-authenticated. Please click Send again.");
        }
        throw error;
    }
};