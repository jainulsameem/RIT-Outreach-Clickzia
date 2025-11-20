
import { createClient } from '@supabase/supabase-js';

// Use import.meta.env for Vite native support, fall back to process.env (replaced by define), then hardcoded string as safety net.
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://naluvcnrihsefjlbefqg.supabase.co';
const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbHV2Y25yaWhzZWZqbGJlZnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyNjkxMjgsImV4cCI6MjA3ODg0NTEyOH0.8rt6tI3MHF0m7JTCm-D2tkChrPBzbl8h8cdVlaxCY1Y';

if (!supabaseUrl) {
    console.error('Supabase URL is missing. App may crash.');
}

// Initialize Supabase client
export const supabase = createClient(
    supabaseUrl, 
    supabaseKey
);
