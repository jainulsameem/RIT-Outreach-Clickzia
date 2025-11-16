
import { createClient } from '@supabase/supabase-js';

// We rely on process.env which is explicitly defined in vite.config.ts.
const supabaseUrl = process.env.SUPABASE_URL || 'https://naluvcnrihsefjlbefqg.supabase.co';

// Use process.env, but fallback to the hardcoded key if the env var replacement fails for any reason.
// This ensures the app works immediately with the credentials you provided.
const providedKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbHV2Y25yaWhzZWZqbGJlZnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyNjkxMjgsImV4cCI6MjA3ODg0NTEyOH0.8rt6tI3MHF0m7JTCm-D2tkChrPBzbl8h8cdVlaxCY1Y';

const supabaseKey = process.env.SUPABASE_ANON_KEY || providedKey;

if (!supabaseKey) {
    console.error('Supabase Anon Key is missing! The app will not be able to fetch data.');
} else {
    // Log masked key for debugging
    console.log(`Supabase Client initialized. Key length: ${supabaseKey.length}`);
}

// Initialize Supabase client
export const supabase = createClient(
    supabaseUrl, 
    supabaseKey
);
