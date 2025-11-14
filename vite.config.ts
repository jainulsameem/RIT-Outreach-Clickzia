import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// FIX: Explicitly import `process` to ensure correct type definitions for `process.cwd()`.
import process from 'node:process'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Expose the API key to the app code, stringified to be a valid JS string
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY)
    }
  }
})
