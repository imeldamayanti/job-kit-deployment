// The shared build (`npm run build:share`) has no AI: no key, no provider, no calls. Everything AI-shaped checks this one flag.
export const isShareBuild = (value: unknown): boolean => value === 'true'
export const AI_ENABLED: boolean = !isShareBuild(import.meta.env.WXT_SHARE_BUILD)
