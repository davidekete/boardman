'use client'

import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  prefix?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, prefix, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]"
            style={{ fontFamily: 'var(--font-dm)' }}
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <span
              className="absolute left-3 text-[var(--muted)] text-sm pointer-events-none select-none"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              'w-full bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] text-sm placeholder-[var(--muted)] outline-none transition-colors duration-150',
              'focus:border-[var(--primary)] focus:ring-1 focus:ring-[rgba(232,255,71,0.2)]',
              'h-10 px-3',
              prefix ? 'pl-7' : '',
              error ? 'border-[var(--danger)]' : '',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ fontFamily: 'var(--font-dm)' }}
            {...props}
          />
        </div>
        {error && (
          <p
            className="text-xs text-[var(--danger)]"
            style={{ fontFamily: 'var(--font-dm)' }}
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
