import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Profile } from '../../core/profile/types'
import { compareCv, type CvParts, type Seg } from '../../core/tailor/diff'
import { formatPeriod } from '../../core/tailor/format'

// Added words are green and cut words struck through. Red is not used: red means failed (design-system §4.4).
function Segments({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((seg, index) =>
        seg.kind === 'add' ? (
          <ins key={index} className="rounded-sm bg-green-50 text-green-700 no-underline">{seg.text}</ins>
        ) : seg.kind === 'rm' ? (
          <del key={index} className="text-text-secondary line-through decoration-neutral-400">{seg.text}</del>
        ) : (
          <span key={index}>{seg.text}</span>
        ),
      )}
    </>
  )
}

function Tags({ names }: { names: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {names.map((name) => (
        <span key={name} className="rounded-md bg-neutral-100 px-2 py-0.5 text-[12px] font-medium text-text-primary">{name}</span>
      ))}
    </div>
  )
}

const Note = ({ children }: { children: ReactNode }) => <p className="mt-1.5 text-[12px] text-text-secondary">{children}</p>

function Section({ title, meta, children }: { title: string; meta?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-[13px] font-bold text-text-primary">{title}</h4>
      {meta && <p className="text-[12px] text-text-secondary">{meta}</p>}
      {children}
    </div>
  )
}

function Pane({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <h3 className="flex flex-wrap items-center justify-between gap-2 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">
        <span>{title}</span>
        {badge}
      </h3>
      {children}
    </section>
  )
}

const bulletList = (rows: (Seg[] | null)[]) => (
  <ul className="flex flex-col gap-1.5 pl-4 text-[13px] leading-snug text-text-primary [list-style:disc]">
    {rows.map((segs, index) => (segs ? <li key={index}><Segments segs={segs} /></li> : null))}
  </ul>
)

const jobMeta = (company: string, period: string) => [company, period].filter((x) => x !== '').join(' · ')

// The Profile on the left and the CV on the right (FR-41). Job titles, employers, schools and dates are the same on both
// sides because they come from the Profile; only the wording of bullets and the choice and order of skills differ.
export function CvDiff({ profile, parts, validated }: { profile: Profile; parts: CvParts; validated: boolean }) {
  const compare = compareCv(profile, parts)
  const droppedSkills = compare.skills.dropped.length

  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-3 @[760px]:grid-cols-2">
        <Pane title="Asli (Profile)">
          <Section title="Skill">
            <Tags names={compare.skills.original} />
          </Section>
          {compare.experience.map((exp) => (
            <Section key={exp.sourceId} title={exp.title} meta={jobMeta(exp.company, formatPeriod(exp.start, exp.end, exp.current))}>
              {bulletList(exp.rows.map((row) => row.before))}
            </Section>
          ))}
          {compare.education.map((edu) => (
            <Section key={edu.id} title={[edu.level, edu.major].filter((x) => x !== '').join(' ')} meta={[edu.institution, edu.year].filter((x) => x !== '').join(' · ')} />
          ))}
        </Pane>

        <Pane
          title="Disesuaikan untuk lowongan ini"
          badge={
            validated ? (
              <span className="inline-flex items-center gap-1 rounded-sm bg-green-50 px-1.5 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-green-700">
                <ShieldCheck size={12} strokeWidth={2.25} aria-hidden="true" />
                Tervalidasi
              </span>
            ) : (
              <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-text-secondary">Diedit</span>
            )
          }
        >
          <Section title="Skill">
            <Tags names={compare.skills.tailored} />
            <Note>
              {compare.skills.reordered ? 'Urutan diubah; ' : ''}
              tidak ada skill ditambah{droppedSkills > 0 ? `. ${droppedSkills} skill tidak dipilih (masih ada di Profile).` : '.'}
            </Note>
          </Section>
          {compare.experience.map((exp) => (
            <Section key={exp.sourceId} title={exp.title} meta={jobMeta(exp.company, formatPeriod(exp.start, exp.end, exp.current))}>
              {bulletList(exp.rows.map((row) => row.after))}
              {exp.hidden > 0 && <Note>{exp.hidden} butir tidak dipakai (masih ada di Profile).</Note>}
            </Section>
          ))}
          {compare.omittedExperience > 0 && <Note>{compare.omittedExperience} pengalaman tidak disertakan (masih ada di Profile).</Note>}
          {compare.education.map((edu) => (
            <Section key={edu.id} title={[edu.level, edu.major].filter((x) => x !== '').join(' ')} meta={[edu.institution, edu.year].filter((x) => x !== '').join(' · ')} />
          ))}
        </Pane>
      </div>
    </div>
  )
}
