// Bundles the Supabase Edge Functions from supabase/functions-src into supabase/functions (git-ignored build output). The handlers live in
// src/server and src/core, so the server and the extension share one source; Deno gets one self-contained file per function.
import { build } from 'esbuild'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const FUNCTIONS = ['generate', 'create-payment', 'tripay-callback']

for (const name of FUNCTIONS) {
  rmSync(`${root}supabase/functions/${name}`, { recursive: true, force: true })
  await build({
    entryPoints: [`${root}supabase/functions-src/${name}/index.ts`],
    outfile: `${root}supabase/functions/${name}/index.ts`,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    legalComments: 'none',
    logLevel: 'warning',
  })
  console.log(`built supabase/functions/${name}/index.ts`)
}
