import { useId, type TextareaHTMLAttributes } from 'react'

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & { label: string }

export function TextArea({ label, className = '', ...props }: TextAreaProps) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-semibold text-text-secondary">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        className={
          'w-full min-w-0 resize-y rounded-md border border-border-strong bg-surface-input px-3 py-2 text-[14px] text-text-primary ' +
          'placeholder:text-neutral-500 transition-colors duration-150 hover:border-neutral-400 ' +
          'focus-visible:border-focus-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring ' +
          className
        }
        {...props}
      />
    </div>
  )
}
