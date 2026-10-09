import type { ButtonHTMLAttributes } from 'react'
import { motion, useReducedMotion } from 'motion/react'

type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'
>

export function Button({ className = '', type = 'button', ...props }: ButtonProps) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type={type}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
      className={
        'inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-[13px] font-semibold text-text-on-accent ' +
        'transition-colors duration-150 hover:bg-accent-hover active:bg-accent-pressed ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ' +
        'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 ' +
        className
      }
      {...props}
    />
  )
}
