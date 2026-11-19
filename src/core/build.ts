// How the build uses AI (spec §5, §6):
//   server - the default: AI runs on our server, paid with credits, behind an account.
//   byok   - the owner's own build (`npm run dev:byok` / `build:byok`): the owner pastes their own key, no account.
//   off    - the shared build (`npm run build:share`): no key, no provider, no calls.
export type AiMode = 'server' | 'byok' | 'off'

export const isShareBuild = (value: unknown): boolean => value === 'true'

// The shared build wins over everything: it must never carry AI, whatever the mode says.
export function aiModeFrom(mode: unknown, share: unknown): AiMode {
  if (isShareBuild(share)) return 'off'
  return mode === 'byok' ? 'byok' : 'server'
}

export const AI_MODE: AiMode = aiModeFrom(import.meta.env.WXT_AI_MODE, import.meta.env.WXT_SHARE_BUILD)
// Everything AI-shaped checks this one flag (the name predates the modes).
export const AI_ENABLED: boolean = AI_MODE !== 'off'
// The Threads source reads a logged-in session, which is for the owner's own browser only, so it stays out of the shared build.
export const THREAD_ENABLED: boolean = !isShareBuild(import.meta.env.WXT_SHARE_BUILD)
