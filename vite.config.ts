
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables from .env files into process.env
  // Using (process as any).cwd() to avoid TS errors if node types aren't perfect
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Handle various naming conventions for Supabase variables
  // We use the provided URL and Key as default fallbacks
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || 'https://naluvcnrihsefjlbefqg.supabase.co';
  
  // Specific key provided by user
  const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbHV2Y25yaWhzZWZqbGJlZnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyNjkxMjgsImV4cCI6MjA3ODg0NTEyOH0.8rt6tI3MHF0m7JTCm-D2tkChrPBzbl8h8cdVlaxCY1Y';
  
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultKey;
  const apiKey = env.VITE_API_KEY || env.API_KEY || '';

  return {
    plugins: [react()],
    define: {
      // Expose these variables to the client-side code via process.env
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
    }
  }
})
