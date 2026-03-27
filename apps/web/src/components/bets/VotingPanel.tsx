'use client'

import { useState } from 'react'
import type { BetParticipant } from '@boardman/shared'
import { Button } from '@/components/ui/Button'
import { ParticipantAvatar } from '@/components/ui/ParticipantAvatar'
import { useVote } from '@/lib/queries'
import { getUsernameInitials } from '@/lib/utils'

interface VotingPanelProps {
  betId: string
  participants: BetParticipant[]
  currentUserId: string
}

export function VotingPanel({ betId, participants, currentUserId }: VotingPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [voted, setVoted] = useState(false)
  const vote = useVote()

  if (voted) {
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

  async function handleConfirm() {
    if (!selectedId) return
    try {
      await vote.mutateAsync({ betId, winnerId: selectedId })
      setVoted(true)
    } catch {
      // Error surfaced via button state
    }
  }

  const selectedUser = participants.find((p) => p.userId === selectedId)

  return (
    <div className="flex flex-col gap-5">
      <h3
        style={{
          fontFamily: 'var(--font-bebas)',
          fontSize: '28px',
          color: 'var(--text)',
          letterSpacing: '0.04em',
        }}
      >
        WHO WON?
      </h3>

      {/* 2-col grid */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}
      >
        {participants.map((p) => {
          const isSelected = selectedId === p.userId
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.userId)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '16px 12px',
                borderRadius: '6px',
                border: `1px solid ${isSelected ? 'transparent' : 'var(--border)'}`,
                backgroundColor: isSelected ? 'var(--primary)' : 'var(--surface)',
                color: isSelected ? '#0D0D0D' : 'var(--text)',
                cursor: 'pointer',
                transition: 'transform 150ms, background-color 150ms',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = isSelected
                  ? 'scale(1.02)'
                  : 'scale(1)'
              }}
            >
              <ParticipantAvatar
                initials={getUsernameInitials(p.username)}
                size={56}
              />
              <div className="text-center">
                <p
                  style={{
                    fontFamily: 'var(--font-dm)',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: isSelected ? '#0D0D0D' : 'var(--text)',
                  }}
                >
                  @{p.username}
                </p>
                {p.userId === currentUserId && (
                  <p
                    style={{
                      fontFamily: 'var(--font-dm)',
                      fontSize: '11px',
                      color: isSelected ? 'rgba(13,13,13,0.6)' : 'var(--muted)',
                    }}
                  >
                    You
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Confirm CTA */}
      <Button
        variant="primary"
        size="lg"
        disabled={!selectedId}
        loading={vote.isPending}
        fullWidth
        onClick={handleConfirm}
      >
        {selectedUser
          ? `Declaring @${selectedUser.username} as winner`
          : 'Confirm Vote'}
      </Button>
    </div>
  )
}
