import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
  label: string
  children: ReactNode
}

export function IconButton({ label, children, className = '', type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 ' +
        'hover:bg-neutral-100 hover:text-text-primary active:bg-neutral-200 ' +
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring ' +
        'disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent ' +
        className
      }
      {...props}
    >
      {children}
    </button>
  )
}
