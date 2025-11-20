
import { createClient } from '@supabase/supabase-js';

// Fallback configuration to ensure the app works even if environment variables fail to load.
// This ensures we connect to the existing database and don't lose data.
const FALLBACK_URL = 'https://naluvcnrihsefjlbefqg.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbHV2Y25yaWhzZWZqbGJlZnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyNjkxMjgsImV4cCI6MjA3ODg0NTEyOH0.8rt6tI3MHF0m7JTCm-D2tkChrPBzbl8h8cdVlaxCY1Y';

const getSupabaseConfig = () => {
    let url = '';
    let key = '';

    // 1. Try standard Vite environment variables
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        url = import.meta.env.VITE_SUPABASE_URL || '';
        key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    }

    // 2. Try process.env (if injected by build tools)
    if ((!url || !key) && typeof process !== 'undefined' && process.env) {
        url = url || process.env.SUPABASE_URL || '';
        key = key || process.env.SUPABASE_ANON_KEY || '';
    }

    // 3. Use Fallbacks if variables are missing
    url = url || FALLBACK_URL;
    key = key || FALLBACK_KEY;

    return { url, key };
};

const { url, key } = getSupabaseConfig();

if (!url || !key) {
    console.error('CRITICAL: Supabase URL or Key is missing. The app will not function correctly.');
}

// Initialize Supabase client with guaranteed values
export const supabase = createClient(url, key);
