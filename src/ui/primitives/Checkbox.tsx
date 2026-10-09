import { Check } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode } from 'react'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
  children: ReactNode
}

export function Checkbox({ children, className = '', ...props }: CheckboxProps) {
  return (
    <label className={'flex cursor-pointer items-start gap-3 ' + className}>
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className={
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface-input text-text-on-accent ' +
          'transition-colors duration-150 peer-checked:border-accent peer-checked:bg-accent ' +
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring ' +
          '[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100'
        }
      >
        <Check size={12} strokeWidth={3} />
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  )
}
