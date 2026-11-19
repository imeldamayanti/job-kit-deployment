import type { AiProvider } from '../feed/settings'

// Where the own-key build sends a request. Apart from core/feed/settings.ts on purpose: only the own-key build reaches this module,
// so the server build carries none of these addresses (src/core/build.test.ts reads the bundle for that).
export const BRIDGE_URL = 'http://127.0.0.1:8787/complete'

const AI_ORIGINS: Record<AiProvider, string[]> = {
  anthropic: ['https://api.anthropic.com/*'],
  gemini: ['https://generativelanguage.googleapis.com/*'],
  'opencode-zen': ['https://opencode.ai/*'],
  'claude-code': ['http://127.0.0.1/*'],
}

export const aiOrigins = (provider: AiProvider): string[] => AI_ORIGINS[provider]
