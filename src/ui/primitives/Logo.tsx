import { ClipboardCheck } from 'lucide-react'

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center rounded-md bg-accent text-text-on-accent"
    >
      <ClipboardCheck size={Math.round(size * 0.58)} strokeWidth={2} />
    </span>
  )
}
