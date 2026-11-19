/// <reference types="vite/client" />

interface ImportMetaEnv {
  // "true" in the shared build (npm run build:share), which has no AI.
  readonly WXT_SHARE_BUILD?: string
  // "byok" in the owner's own build (npm run dev:byok / build:byok): own key, no account. Anything else is the server mode.
  readonly WXT_AI_MODE?: string
}
