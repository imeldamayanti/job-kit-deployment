import type { ButtonHTMLAttributes } from 'react'
import { motion, useReducedMotion } from 'motion/react'

type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'
> & { variant?: 'primary' | 'secondary' | 'danger' }

const VARIANTS = {
  primary:
    'bg-accent text-text-on-accent hover:bg-accent-hover active:bg-accent-pressed disabled:bg-neutral-100 disabled:text-neutral-500',
  secondary:
    'border border-border-strong bg-surface text-accent hover:bg-accent-wash active:bg-neutral-100 disabled:border-border disabled:bg-neutral-100 disabled:text-neutral-500',
  danger:
    'border border-border bg-rose-50 text-rose-700 hover:border-rose-700 active:bg-rose-50 disabled:bg-neutral-100 disabled:text-neutral-500 disabled:hover:border-border',
}

export function Button({ className = '', type = 'button', variant = 'primary', ...props }: ButtonProps) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type={type}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
      className={
        'inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-semibold ' +
        'transition-colors duration-150 ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ' +
        'disabled:cursor-not-allowed ' +
        VARIANTS[variant] +
        ' ' +
        className
      }
      {...props}
    />
  )
}
