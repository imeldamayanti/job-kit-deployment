import { X } from 'lucide-react'
import { useId, useState } from 'react'
import { addListItem, removeListItem } from '../../core/profile/job-preferences'

type ChipListFieldProps = {
  label: string
  hint?: string
  placeholder: string
  items: string[]
  onChange: (items: string[]) => void
}

// A list of short words: type one, press Enter or comma, remove with the x.
export function ChipListField({ label, hint, placeholder, items, onChange }: ChipListFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState('')

  function commit() {
    if (draft.trim() === '') return
    onChange(addListItem(items, draft))
    setDraft('')
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-text-primary">
        {label}
      </label>
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-wash py-1 pr-1.5 pl-3 text-[13px] font-semibold text-accent"
            >
              {item}
              <button
                type="button"
                aria-label={`Hapus ${item}`}
                onClick={() => onChange(removeListItem(items, item))}
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-focus-ring"
              >
                <X size={12} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            commit()
          }
        }}
        onBlur={commit}
        className={
          'h-9 w-full min-w-0 rounded-md border border-border-strong bg-surface-input px-3 text-[14px] text-text-primary ' +
          'placeholder:text-neutral-500 transition-colors duration-150 hover:border-neutral-400 ' +
          'focus-visible:border-focus-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring'
        }
      />
      {hint && <p className="text-[12px] text-text-secondary">{hint}</p>}
    </div>
  )
}
