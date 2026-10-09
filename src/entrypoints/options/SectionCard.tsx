import type { ReactNode } from 'react'

export function SectionCard({ children }: { children: ReactNode }) {
  return <section className="rounded-xl border border-border bg-surface p-5 shadow-md">{children}</section>
}
