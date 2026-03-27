import { Button } from './Button'

interface EmptyStateProps {
  label: string
  description?: string
  ctaLabel?: string
  onCta?: () => void
}

export function EmptyState({
  label,
  description,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span
        style={{
          fontFamily: 'var(--font-bebas)',
          fontSize: '40px',
          color: 'var(--border)',
          lineHeight: 1,
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      {description && (
        <p
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '14px',
            color: 'var(--muted)',
          }}
        >
          {description}
        </p>
      )}
      {ctaLabel && onCta && (
        <Button variant="primary" size="md" onClick={onCta} className="mt-2">
          {ctaLabel}
        </Button>
      )}
    </div>
  )
}
