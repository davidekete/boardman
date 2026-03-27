'use client'

import { BetStatus, Bet, BetParticipant } from '@boardman/shared'
import { useBet, useMe, useAcceptBet, useDeclineBet, useOpenVoting, type User } from '@/lib/queries'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ParticipantAvatar } from '@/components/ui/ParticipantAvatar'
import { Button } from '@/components/ui/Button'
import { VotingPanel } from './VotingPanel'
import { getCountdown, formatCurrency, getPotAmount, getUsernameInitials } from '@/lib/utils'

interface BetDetailPanelProps {
  id: string
}

export function BetDetailPanel({ id }: BetDetailPanelProps) {
  const { data: bet, isLoading } = useBet(id)
  const { data: me } = useMe()
  const accept = useAcceptBet()
  const decline = useDeclineBet()
  const openVoting = useOpenVoting()

  if (isLoading || !bet) {
    return (
      <div
        style={{
          minHeight: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
          fontFamily: 'var(--font-dm)',
          fontSize: '14px',
        }}
      >
        Loading...
      </div>
    )
  }

  const countdown = getCountdown(bet.expiresAt)
  const pot = getPotAmount(bet.stakeAmount, bet.participants.length)
  const myParticipant = bet.participants.find((p) => p.userId === me?.id)
  const hasVoted = !!myParticipant?.votedAt
  const winner = bet.winnerId
    ? (bet.participants.find((p) => p.userId === bet.winnerId) ?? null)
    : null

  const urgencyColor: Record<string, string> = {
    normal: 'var(--muted)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
  }

  return (
    <div className="flex flex-col gap-8" style={{ maxWidth: 640 }}>
      {/* Top section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <StatusBadge status={bet.status} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: urgencyColor[countdown.urgency],
              fontWeight: countdown.urgency === 'danger' ? 700 : 400,
            }}
          >
            {countdown.text}
          </span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--text)',
            lineHeight: '1.3',
          }}
        >
          {bet.title}
        </h1>

        {bet.terms && (
          <p
            style={{
              fontFamily: 'var(--font-dm)',
              fontSize: '14px',
              color: 'var(--muted)',
              lineHeight: '1.6',
            }}
          >
            {bet.terms}
          </p>
        )}

        <div>
          <p
            style={{
              fontFamily: 'var(--font-dm)',
              fontSize: '10px',
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '2px',
            }}
          >
            POT
          </p>
          <p
            style={{
              fontFamily: 'var(--font-bebas)',
              fontSize: '56px',
              color: 'var(--text)',
              lineHeight: 1,
              letterSpacing: '0.02em',
            }}
          >
            {formatCurrency(pot)}
          </p>
        </div>
      </div>

      {/* Participants */}
      <div>
        <h2
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '12px',
          }}
        >
          Participants
        </h2>
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            overflow: 'hidden',
          }}
        >
          {bet.participants.map((p, i) => {
            let statusLabel: string
            let statusColor: string

            if (p.votedAt) {
              statusLabel = 'Voted'
              statusColor = 'var(--success)'
            } else if (p.accepted === null) {
              statusLabel = 'Invited'
              statusColor = 'var(--muted)'
            } else if (p.accepted === true) {
              statusLabel = '✓ In'
              statusColor = 'var(--success)'
            } else {
              statusLabel = 'Declined'
              statusColor = 'var(--danger)'
            }

            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom:
                    i < bet.participants.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <ParticipantAvatar
                    initials={getUsernameInitials(p.username)}
                    size={40}
                    title={`@${p.username}`}
                  />
                  <div>
                    <p
                      style={{
                        fontFamily: 'var(--font-dm)',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      @{p.username}
                      {p.userId === me?.id && (
                        <span
                          style={{
                            fontFamily: 'var(--font-dm)',
                            fontSize: '11px',
                            color: 'var(--muted)',
                            marginLeft: 6,
                            fontWeight: 400,
                          }}
                        >
                          (you)
                        </span>
                      )}
                    </p>
                    {p.userId === bet.creatorId && (
                      <p
                        style={{
                          fontFamily: 'var(--font-dm)',
                          fontSize: '11px',
                          color: 'var(--muted)',
                        }}
                      >
                        Creator
                      </p>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-dm)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: statusColor,
                  }}
                >
                  {statusLabel}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Action area */}
      <ActionArea
        bet={bet}
        myParticipant={myParticipant}
        me={me}
        hasVoted={hasVoted}
        winner={winner}
        accept={accept}
        decline={decline}
        openVoting={openVoting}
      />
    </div>
  )
}

function ActionArea({
  bet,
  myParticipant,
  me,
  hasVoted,
  winner,
  accept,
  decline,
  openVoting,
}: {
  bet: Bet
  myParticipant: BetParticipant | undefined
  me: User | undefined
  hasVoted: boolean
  winner: BetParticipant | null
  accept: ReturnType<typeof useAcceptBet>
  decline: ReturnType<typeof useDeclineBet>
  openVoting: ReturnType<typeof useOpenVoting>
}) {
  if (!bet || !me) return null

  const busy = accept.isPending || decline.isPending

  // PENDING + invited
  if (bet.status === BetStatus.PENDING && myParticipant?.accepted === null) {
    return (
      <div className="flex flex-col gap-3">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={accept.isPending}
          disabled={busy}
          onClick={() => accept.mutate(bet.id)}
        >
          Accept Bet
        </Button>
        <Button
          variant="danger"
          size="lg"
          fullWidth
          loading={decline.isPending}
          disabled={busy}
          onClick={() => decline.mutate(bet.id)}
        >
          Decline
        </Button>
      </div>
    )
  }

  // ACTIVE + creator
  if (bet.status === BetStatus.ACTIVE && bet.creatorId === me.id) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="surface"
          size="md"
          loading={openVoting.isPending}
          onClick={() => openVoting.mutate(bet.id)}
          style={{ color: 'var(--warning)' } as React.CSSProperties}
        >
          Mark Event as Done
        </Button>
        <p
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '12px',
            color: 'var(--muted)',
          }}
        >
          Open voting once the event has concluded
        </p>
      </div>
    )
  }

  // VOTING + not voted
  if (bet.status === BetStatus.VOTING && !hasVoted && me) {
    return (
      <VotingPanel
        betId={bet.id}
        participants={bet.participants}
        currentUserId={me.id}
      />
    )
  }

  // VOTING + voted
  if (bet.status === BetStatus.VOTING && hasVoted) {
    return (
      <p
        style={{
          fontFamily: 'var(--font-dm)',
          fontSize: '14px',
          color: 'var(--muted)',
        }}
      >
        Vote submitted. Waiting for others...
      </p>
    )
  }

  // SETTLED
  if (bet.status === BetStatus.SETTLED && winner) {
    const winnings = bet.stakeAmount * bet.participants.length
    return (
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          padding: '20px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: '12px',
            color: 'var(--muted)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Winner
        </p>
        <p
          style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: '40px',
            color: 'var(--primary)',
            lineHeight: 1,
            letterSpacing: '0.02em',
          }}
        >
          @{winner.username}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '16px',
            color: 'var(--success)',
            fontWeight: 600,
            marginTop: 8,
          }}
        >
          {formatCurrency(winnings)}
        </p>
      </div>
    )
  }

  // DISPUTED
  if (bet.status === BetStatus.DISPUTED) {
    return (
      <div>
        <p
          style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: '28px',
            color: 'var(--danger)',
            letterSpacing: '0.04em',
          }}
        >
          OUTCOME DISPUTED
        </p>
        <p
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '14px',
            color: 'var(--muted)',
            marginTop: 4,
          }}
        >
          Our team is reviewing this bet.
        </p>
      </div>
    )
  }

  // REFUNDED
  if (bet.status === BetStatus.REFUNDED) {
    return (
      <div>
        <p
          style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: '28px',
            color: 'var(--muted)',
            letterSpacing: '0.04em',
          }}
        >
          BET REFUNDED
        </p>
        <p
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '14px',
            color: 'var(--muted)',
            marginTop: 4,
          }}
        >
          All stakes have been returned to participants.
        </p>
      </div>
    )
  }

  return null
}
