/// <reference types="vite/client" />

interface ImportMetaEnv {
  // "true" in the shared build (npm run build:share), which has no AI.
  readonly WXT_SHARE_BUILD?: string
}
