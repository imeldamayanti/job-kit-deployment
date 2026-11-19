import { AI_MODE } from '../core/build'
import type { ScoringClient } from '../core/ai/score'
import type { AiSource } from '../core/tailor/pipeline'
import { clientWithPermission } from './ai-client'
import { remoteDocument } from './remote'
import type { FeedSettings } from '../core/feed/settings'
import { documentModel } from '../core/feed/settings'

// Where the answer for a CV or a letter comes from, by build: our server (server), the person's own provider (byok), or nowhere
// (off: the buttons are off, so this is never asked). Written as one comparison per mode so each build keeps only its own branch.
export async function documentSource(settings: FeedSettings, key: string, client?: ScoringClient): Promise<AiSource> {
  if (AI_MODE === 'server') return { remote: remoteDocument }
  if (AI_MODE === 'byok') return { client: client ?? (await clientWithPermission(key, settings.ai.provider)), key, model: documentModel(settings) }
  throw new Error('This build has no AI.')
}
