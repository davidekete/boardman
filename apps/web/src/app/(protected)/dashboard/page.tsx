'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BetStatus } from '@boardman/shared'
import { useMe, useWallet, useBets, useAcceptBet, useDeclineBet } from '@/lib/queries'
import { BetCard } from '@/components/ui/BetCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { formatCurrency, getUsernameInitials } from '@/lib/utils'
import { ParticipantAvatar } from '@/components/ui/ParticipantAvatar'

export default function DashboardPage() {
  const router = useRouter()
  const { data: me } = useMe()
  const { data: wallet } = useWallet()
  const { data: bets } = useBets()

  const activeBets = bets?.filter(
    (b) => b.status === BetStatus.ACTIVE || b.status === BetStatus.VOTING
  ) ?? []

  const pendingInvites = bets?.filter((b) => {
    if (b.status !== BetStatus.PENDING) return false
    const myParticipant = b.participants.find((p) => p.userId === me?.id)
    return myParticipant?.accepted === null
  }) ?? []

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      {/* Left column */}
      <div className="flex-1 flex flex-col gap-6">
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-dm)',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '16px',
            }}
          >
            Active Bets
          </h2>

          {activeBets.length === 0 ? (
            <EmptyState
              label="NO ACTIVE BETS"
              description="Create a bet to get started."
              ctaLabel="New Bet"
              onCta={() => router.push('/bets/new')}
            />
          ) : (
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              }}
            >
              {activeBets.map((bet, i) => (
                <BetCard
                  key={bet.id}
                  bet={bet}
                  style={{
                    opacity: 0,
                    animationName: 'fade-up',
                    animationDuration: '300ms',
                    animationDelay: `${i * 100}ms`,
                    animationFillMode: 'forwards',
                    animationTimingFunction: 'ease-out',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-6" style={{ width: '100%', maxWidth: 320 }}>
        {/* Balance widget */}
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
              fontFamily: 'var(--font-dm)',
              fontSize: '10px',
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '4px',
            }}
          >
            Your Balance
          </p>
          <BalanceDisplay amount={wallet?.balance ?? 0} />
          <p
            style={{
              fontFamily: 'var(--font-dm)',
              fontSize: '11px',
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '16px',
            }}
          >
            Available
          </p>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={() => router.push('/wallet')}
          >
            Fund Wallet
          </Button>
        </div>

        {/* Pending invites */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2
              style={{
                fontFamily: 'var(--font-dm)',
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              Pending Invites
            </h2>
            {pendingInvites.length > 0 && (
              <span
                style={{
                  fontFamily: 'var(--font-dm)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--warning)',
                  backgroundColor: 'rgba(251,146,60,0.15)',
                  borderRadius: '9999px',
                  padding: '2px 8px',
                }}
              >
                {pendingInvites.length}
              </span>
            )}
          </div>

          {pendingInvites.length === 0 ? (
            <p
              style={{
                fontFamily: 'var(--font-dm)',
                fontSize: '13px',
                color: 'var(--muted)',
              }}
            >
              No pending invites.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingInvites.map((bet) => {
                const creator = bet.participants.find(
                  (p) => p.userId === bet.creatorId
                )
                return (
                  <InviteCard
                    key={bet.id}
                    betId={bet.id}
                    title={bet.title}
                    creatorUsername={creator?.username ?? 'Unknown'}
                    stakeAmount={bet.stakeAmount}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BalanceDisplay({ amount }: { amount: number }) {
  const [displayed, setDisplayed] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (amount === 0) { setDisplayed(0); return }
    const duration = 800
    const start = performance.now()

    function step(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.floor(eased * amount))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        setDisplayed(amount)
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [amount])

  return (
    <p
      style={{
        fontFamily: 'var(--font-bebas)',
        fontSize: '64px',
        color: 'var(--text)',
        lineHeight: 1,
        letterSpacing: '0.02em',
      }}
    >
      {formatCurrency(displayed)}
    </p>
  )
}

function InviteCard({
  betId,
  title,
  creatorUsername,
  stakeAmount,
}: {
  betId: string
  title: string
  creatorUsername: string
  stakeAmount: number
}) {
  const accept = useAcceptBet()
  const decline = useDeclineBet()

  const busy = accept.isPending || decline.isPending

  return (
    <div
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '14px',
      }}
    >
      <div className="flex items-start gap-2 mb-2">
        <ParticipantAvatar initials={getUsernameInitials(creatorUsername)} size={32} />
        <div>
          <p
            style={{
              fontFamily: 'var(--font-dm)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: '1.3',
            }}
          >
            {title}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-dm)',
              fontSize: '12px',
              color: 'var(--muted)',
            }}
          >
            @{creatorUsername} · {formatCurrency(stakeAmount)} stake
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          loading={accept.isPending}
          disabled={busy}
          onClick={() => accept.mutate(betId)}
          className="flex-1"
        >
          Accept
        </Button>
        <Button
          variant="danger"
          size="sm"
          loading={decline.isPending}
          disabled={busy}
          onClick={() => decline.mutate(betId)}
          className="flex-1"
        >
          Decline
        </Button>
      </div>
    </div>
  )
}
