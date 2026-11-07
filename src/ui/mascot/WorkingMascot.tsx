// The mascot at work (the "processing" drawing): the ring on its antenna turns, so a person can tell something is
// being made and the page is not stuck. Inline SVG rather than an image, because an image cannot be animated from
// the page. Decorative: the words next to it carry the meaning. The turning stops for people who have asked their
// system for less motion.
export function WorkingMascot({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="shrink-0">
      <g fill="none" stroke="#1D4FD7" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        <g className="motion-safe:animate-spin" style={{ transformOrigin: '32px 6.6px' }}>
          <path d="M32 1.6 A5 5 0 1 1 27.2 8.2" stroke="#2563EB" strokeWidth={3} />
        </g>
        <path d="M32 18 V12" />
        <rect x="18.5" y="46" width="11" height="15" rx="5.5" fill="#DBE6FE" />
        <rect x="34.5" y="46" width="11" height="15" rx="5.5" fill="#DBE6FE" />
        <path d="M14.5 35 L6.5 32" strokeWidth={13} />
        <path d="M14.5 35 L6.5 32" stroke="#DBE6FE" strokeWidth={6.2} />
        <path d="M49.5 35 L57.5 32" strokeWidth={13} />
        <path d="M49.5 35 L57.5 32" stroke="#DBE6FE" strokeWidth={6.2} />
        <rect x="14" y="18" width="36" height="34" rx="12" fill="#DBE6FE" />
        <circle cx="25" cy="33" r="3" fill="#1D4FD7" stroke="none" />
        <circle cx="39" cy="33" r="3" fill="#1D4FD7" stroke="none" />
        <circle cx="32" cy="41" r="2.4" strokeWidth={2.8} />
      </g>
    </svg>
  )
}
