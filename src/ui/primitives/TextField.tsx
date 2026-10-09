import { useId, type InputHTMLAttributes } from 'react'

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  hideLabel?: boolean
}

export function TextField({ label, hideLabel = false, className = '', ...props }: TextFieldProps) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-[12px] font-semibold text-text-secondary'}>
        {label}
      </label>
      <input
        id={id}
        className={
          'h-9 w-full min-w-0 rounded-md border border-border-strong bg-surface-input px-3 text-[14px] text-text-primary ' +
          'placeholder:text-neutral-500 transition-colors duration-150 hover:border-neutral-400 ' +
          'focus-visible:border-focus-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring ' +
          className
        }
        {...props}
      />
    </div>
  )
}
