'use client'

import { ButtonHTMLAttributes, CSSProperties, forwardRef } from 'react'

type Variant = 'primary' | 'surface' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
}

const variantStyle: Record<Variant, CSSProperties> = {
  primary: {
    backgroundColor: 'var(--primary)',
    color: '#0D0D0D',
    border: 'none',
  },
  surface: {
    backgroundColor: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  },
  danger: {
    backgroundColor: 'var(--surface)',
    color: 'var(--danger)',
    border: '1px solid var(--border)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    border: 'none',
  },
}

const sizeStyle: Record<Size, CSSProperties> = {
  sm: { height: 32, padding: '0 12px', fontSize: 13 },
  md: { height: 40, padding: '0 16px', fontSize: 14 },
  lg: { height: 48, padding: '0 24px', fontSize: 15 },
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      children,
      style,
      className = '',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: 6,
          fontFamily: 'var(--font-dm)',
          fontWeight: 700,
          letterSpacing: '0.02em',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.4 : 1,
          width: fullWidth ? '100%' : undefined,
          transition: 'transform 150ms, opacity 150ms',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          ...variantStyle[variant],
          ...sizeStyle[size],
          ...style,
        }}
        onMouseEnter={(e) => {
          if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
        }}
        onMouseDown={(e) => {
          if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)'
        }}
        onMouseUp={(e) => {
          if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'
        }}
        {...props}
      >
        {loading ? (
          <>
            <span
              style={{
                display: 'inline-block',
                width: 16,
                height: 16,
                border: '2px solid currentColor',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
              }}
            />
            {children}
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
