// Fix: Remove missing vite/client type reference that was causing build errors.
// /// <reference types="vite/client" />

// By adding this declaration, we tell TypeScript that our build process (Vite)
// will ensure that `process.env.API_KEY` is available at runtime in the browser.
// Fix: Use namespace augmentation to add `API_KEY` to `process.env` type,
// avoiding a global redeclaration of `process` which conflicts with Node.js types.
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
  }
}