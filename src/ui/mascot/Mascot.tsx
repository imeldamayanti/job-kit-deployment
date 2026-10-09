import empty from './empty.svg'
import error from './error.svg'
import success from './success.svg'

const SOURCES = { neutral: empty, error, success }

export type MascotState = keyof typeof SOURCES

// Decorative only: the words next to it carry the meaning, so it is hidden from screen readers.
export function Mascot({ state, size = 64 }: { state: MascotState; size?: number }) {
  return <img src={SOURCES[state]} alt="" width={size} height={size} className="shrink-0" />
}
