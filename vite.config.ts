import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // This tells Vite to replace any occurrence of `process.env.API_KEY` in the app's code
    // with the value of the `VITE_API_KEY` environment variable from the build environment (like Vercel).
    // The `JSON.stringify` is crucial to ensure the key is correctly embedded as a string.
    'process.env.API_KEY': JSON.stringify(process.env.VITE_API_KEY)
  }
})
