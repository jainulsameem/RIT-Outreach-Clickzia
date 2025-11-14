import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// Fix: Removed explicit import from 'process'. Using the `process` global directly in `vite.config.ts`
// avoids polluting the global scope with Node.js types, which can conflict with Vite's client-side types
// and cause errors like "Cannot find type definition file for 'vite/client'".

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables from .env files into process.env
  // Vercel and other platforms will provide these variables automatically
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // The app expects process.env.API_KEY, but standard practice for Vite is to use a VITE_ prefix.
      // This bridges the gap by defining process.env.API_KEY from the VITE_API_KEY build variable.
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY)
    }
  }
})
