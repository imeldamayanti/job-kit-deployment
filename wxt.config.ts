import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  srcDir: 'src',
  imports: false,
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'job-kit',
    description: 'Ketik sekali, lamar di mana saja.',
    permissions: ['storage', 'sidePanel', 'scripting', 'tabs'],
    optional_host_permissions: ['*://*/*'],
    action: { default_title: 'job-kit' },
  },
})
