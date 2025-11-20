
export async function hashPassword(password: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Simple check to see if a string looks like a SHA-256 hash (64 hex characters)
export function isHashed(password: string): boolean {
    const hexRegex = /^[a-f0-9]{64}$/i;
    return hexRegex.test(password);
}
