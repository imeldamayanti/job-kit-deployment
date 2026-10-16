import { ChevronDown } from 'lucide-react'
import { useId, type SelectHTMLAttributes } from 'react'

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & { label: string; hideLabel?: boolean }

export function Select({ label, hideLabel = false, className = '', children, ...props }: SelectProps) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-[12px] font-semibold text-text-secondary'}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className={
            'h-9 w-full min-w-0 appearance-none rounded-md border border-border-strong bg-surface-input pl-3 pr-9 text-[14px] text-text-primary ' +
            'transition-colors duration-150 hover:border-neutral-400 ' +
            'focus-visible:border-focus-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring ' +
            'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-text-secondary disabled:hover:border-border-strong ' +
            className
          }
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
        />
      </div>
    </div>
  )
}
