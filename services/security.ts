
export async function hashPassword(password: string): Promise<string> {
    // Check if Secure Context (required for crypto.subtle)
    if (window.crypto && window.crypto.subtle) {
        try {
            const msgBuffer = new TextEncoder().encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        } catch (e) {
            console.warn("Crypto API failed, falling back to simple hash.", e);
        }
    } else {
        console.warn("Secure Context not detected (HTTP?). Falling back to simple hash for development.");
    }

    // Fallback: Simple DJB2-like hash for non-secure contexts (Dev only, strictly not for prod)
    // This ensures functionality on http://localhost or unsecure IPs during demos
    let hash = 5381;
    for (let i = 0; i < password.length; i++) {
        hash = ((hash << 5) + hash) + password.charCodeAt(i);
    }
    return (hash >>> 0).toString(16).padStart(64, '0'); // Pad to mimic SHA-256 length
}

// Simple check to see if a string looks like a SHA-256 hash (64 hex characters)
export function isHashed(password: string): boolean {
    // If we are in fallback mode, we accept the padded simple hash too
    const hexRegex = /^[a-f0-9]{64}$/i;
    return hexRegex.test(password);
}