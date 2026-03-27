'use client'

import { useRouter } from 'next/navigation'
import type { Bet } from '@boardman/shared'
import { BetStatus } from '@boardman/shared'
import { StatusBadge } from './StatusBadge'
import { ParticipantAvatar } from './ParticipantAvatar'
import { getCountdown, getPotAmount, formatCurrency, getUsernameInitials } from '@/lib/utils'

interface BetCardProps {
  bet: Bet
  style?: React.CSSProperties
}

const urgencyColor: Record<string, string> = {
  normal: 'var(--muted)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
}

export function BetCard({ bet, style }: BetCardProps) {
  const router = useRouter()
  const countdown = getCountdown(bet.expiresAt)
  const pot = getPotAmount(bet.stakeAmount, bet.participants.length)
  const isActive = bet.status === BetStatus.ACTIVE

  return (
    <div
      onClick={() => router.push(`/bets/${bet.id}`)}
      className={isActive ? 'active-bet-pulse' : ''}
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'border-color 200ms',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        ...style,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor =
          'rgba(232,255,71,0.3)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
      }}
    >
      {/* Row 1: Status + countdown */}
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={bet.status} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: urgencyColor[countdown.urgency],
            fontWeight: countdown.urgency === 'danger' ? 700 : 400,
            whiteSpace: 'nowrap',
          }}
        >
          {countdown.text}
        </span>
      </div>

      {/* Row 2: Title */}
      <p
        style={{
          fontFamily: 'var(--font-dm)',
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--text)',
          lineHeight: '1.4',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {bet.title}
      </p>

      {/* Row 3: Pot */}
      <div>
        <p
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '10px',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '2px',
          }}
        >
          POT
        </p>
        <p
          style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: '40px',
            color: 'var(--text)',
            lineHeight: 1,
            letterSpacing: '0.02em',
          }}
        >
          {formatCurrency(pot)}
        </p>
      </div>

      {/* Row 4: Participants */}
      <div className="flex items-center justify-between">
        <div className="flex items-center" style={{ gap: '-4px' }}>
          {bet.participants.slice(0, 5).map((p, i) => (
            <span key={p.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
              <ParticipantAvatar
                initials={getUsernameInitials(p.username)}
                size={28}
                title={`@${p.username}`}
              />
            </span>
          ))}
          {bet.participants.length > 5 && (
            <span
              style={{
                marginLeft: -8,
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: 'var(--border)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-dm)',
                fontSize: '10px',
                color: 'var(--muted)',
                fontWeight: 700,
              }}
            >
              +{bet.participants.length - 5}
            </span>
          )}
        </div>
        <span
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '11px',
            color: 'var(--muted)',
          }}
        >
          {bet.participants.length} players
        </span>
      </div>
    </div>
  )
}
