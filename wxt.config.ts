import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

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
    optional_host_permissions: ['*://*/*'],
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    action: { default_title: 'job-kit', default_icon: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' } },
  },
})
