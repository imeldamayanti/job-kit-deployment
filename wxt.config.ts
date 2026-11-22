import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'
import { aiModeFrom } from './src/core/build'
import { SUPABASE_CONFIG } from './src/core/sync/config'

// Server mode talks to Supabase for every AI call, so its host is granted at install. The other modes make no AI call
// through it, so they keep the host optional, asked only when the person turns sync on (platform/sync.ts).
const aiMode = aiModeFrom(process.env.WXT_AI_MODE, process.env.WXT_SHARE_BUILD)
const supabaseHost = `${new URL(SUPABASE_CONFIG.url).origin}/*`

export default defineConfig({
  srcDir: 'src',
  // The shared build (no AI) goes to its own folder so it never overwrites the local one.
  outDir: process.env.WXT_SHARE_BUILD === 'true' ? '.output-share' : '.output',
  imports: false,
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'job-kit',
    description: 'Ketik sekali, lamar di mana saja.',
    permissions: ['storage', 'sidePanel', 'scripting', 'tabs', 'offscreen', 'alarms'],
    ...(aiMode === 'server' ? { host_permissions: [supabaseHost] } : {}),
    optional_host_permissions: ['*://*/*'],
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    action: { default_title: 'job-kit', default_icon: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' } },
  },
})
