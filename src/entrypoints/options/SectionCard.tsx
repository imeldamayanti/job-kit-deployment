import type { ReactNode } from 'react'

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-md">
      <h2 className="mb-4 text-[17px] font-bold text-text-primary">{title}</h2>
      {children}
    </section>
  )
}
