
interface ImportMetaEnv {
  readonly VITE_API_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
  }
}
