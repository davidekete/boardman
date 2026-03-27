'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BetStatus } from '@boardman/shared'
import { useBets } from '@/lib/queries'
import { BetCard } from '@/components/ui/BetCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

type Tab = 'ALL' | BetStatus

const TABS: { label: string; value: Tab }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: BetStatus.ACTIVE },
  { label: 'Pending', value: BetStatus.PENDING },
  { label: 'Settled', value: BetStatus.SETTLED },
  { label: 'Disputed', value: BetStatus.DISPUTED },
]

export default function BetsPage() {
  const router = useRouter()
  const { data: bets } = useBets()
  const [activeTab, setActiveTab] = useState<Tab>('ALL')

  const filtered =
    activeTab === 'ALL'
      ? (bets ?? [])
      : (bets ?? []).filter((b) => b.status === activeTab)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: '40px',
            color: 'var(--text)',
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}
        >
          BETS
        </h1>
        {/* Desktop CTA */}
        <div className="hidden md:block">
          <Button variant="primary" size="md" onClick={() => router.push('/bets/new')}>
            + New Bet
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex items-center gap-1 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0' }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              style={{
                fontFamily: 'var(--font-dm)',
                fontSize: '14px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--primary)' : 'var(--muted)',
                background: 'none',
                border: 'none',
                borderBottom: isActive
                  ? '2px solid var(--primary)'
                  : '2px solid transparent',
                padding: '8px 14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 150ms, border-color 150ms',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          label="NO BETS YET"
          description="Create a bet and invite some friends."
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
          {filtered.map((bet, i) => (
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

      {/* Mobile FAB */}
      <button
        type="button"
        className="md:hidden"
        onClick={() => router.push('/bets/new')}
        style={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: 'var(--primary)',
          color: '#0D0D0D',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-bebas)',
          fontSize: '28px',
          boxShadow: '0 4px 16px rgba(232,255,71,0.35)',
          zIndex: 40,
        }}
        aria-label="New Bet"
      >
        +
      </button>
    </div>
  )
}
