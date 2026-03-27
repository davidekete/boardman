import { BetStatus } from '@boardman/shared'

interface StatusBadgeProps {
  status: BetStatus
}

const badgeStyles: Record<BetStatus, { bg: string; color: string; shadow?: string }> = {
  [BetStatus.PENDING]: {
    bg: '#2A2A2A',
    color: 'var(--muted)',
  },
  [BetStatus.ACTIVE]: {
    bg: 'rgba(232,255,71,0.15)',
    color: 'var(--primary)',
    shadow: '0 0 8px rgba(232,255,71,0.3)',
  },
  [BetStatus.VOTING]: {
    bg: 'rgba(251,146,60,0.15)',
    color: 'var(--warning)',
  },
  [BetStatus.CONSENSUS]: {
    bg: 'rgba(74,222,128,0.15)',
    color: 'var(--success)',
  },
  [BetStatus.SETTLED]: {
    bg: 'rgba(74,222,128,0.15)',
    color: 'var(--success)',
  },
  [BetStatus.REFUNDED]: {
    bg: '#1A1A1A',
    color: 'var(--muted)',
  },
  [BetStatus.DISPUTED]: {
    bg: 'rgba(248,113,113,0.15)',
    color: 'var(--danger)',
  },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = badgeStyles[status] ?? badgeStyles[BetStatus.PENDING]

  return (
    <span
      style={{
        backgroundColor: styles.bg,
        color: styles.color,
        boxShadow: styles.shadow,
        fontFamily: 'var(--font-dm)',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        padding: '4px 10px',
        borderRadius: '9999px',
        textTransform: 'uppercase',
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  )
}
