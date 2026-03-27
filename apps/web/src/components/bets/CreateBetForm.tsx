'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ParticipantAvatar } from '@/components/ui/ParticipantAvatar'
import { useCreateBet, useUserSearch, SearchedUser } from '@/lib/queries'
import { formatCurrency, getUsernameInitials } from '@/lib/utils'

const DURATION_OPTIONS = [
  { label: '1 Day', value: 1 },
  { label: '3 Days', value: 3 },
  { label: '7 Days', value: 7 },
]

export function CreateBetForm() {
  const router = useRouter()
  const createBet = useCreateBet()

  const [title, setTitle] = useState('')
  const [terms, setTerms] = useState('')
  const [stake, setStake] = useState('')
  const [duration, setDuration] = useState(3)
  const [participants, setParticipants] = useState<SearchedUser[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [error, setError] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: searchResults } = useUserSearch(debouncedQuery)

  const filteredResults = searchResults?.filter(
    (u) => !participants.find((p) => p.id === u.id)
  ) ?? []

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearchQuery(val)
    setShowDropdown(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(val), 300)
  }

  function addParticipant(user: SearchedUser) {
    if (participants.length >= 9) return
    setParticipants((prev) => [...prev, user])
    setSearchQuery('')
    setDebouncedQuery('')
    setShowDropdown(false)
  }

  function removeParticipant(id: string) {
    setParticipants((prev) => prev.filter((p) => p.id !== id))
  }

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const stakeNumber = parseFloat(stake) || 0
  const potPreview = stakeNumber * (participants.length + 1)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError('')
      if (!title.trim()) { setError('Bet title is required'); return }
      if (stakeNumber <= 0) { setError('Enter a valid stake amount'); return }

      try {
        const data = await createBet.mutateAsync({
          title: title.trim(),
          terms: terms.trim() || undefined,
          stakeAmount: stakeNumber,
          participantUsernames: participants.map((p) => p.username),
          expiresInDays: duration,
        })
        router.push(`/bets/${(data as { id: string }).id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create bet')
      }
    },
    [title, terms, stakeNumber, participants, duration, createBet, router]
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Title */}
      <Input
        label="Bet Title"
        placeholder="Who wins the match?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />

      {/* Terms */}
      <div className="flex flex-col gap-1.5">
        <label
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--muted)',
          }}
        >
          Terms (optional)
        </label>
        <textarea
          placeholder="Describe the exact conditions for winning..."
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          rows={3}
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text)',
            fontFamily: 'var(--font-dm)',
            fontSize: '14px',
            padding: '10px 12px',
            resize: 'vertical',
            outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
        />
      </div>

      {/* Stake */}
      <div>
        <Input
          label="Stake Per Person"
          type="number"
          placeholder="5000"
          prefix="₦"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          min="1"
        />
        {stakeNumber > 0 && (
          <p
            style={{
              fontFamily: 'var(--font-dm)',
              fontSize: '13px',
              color: 'var(--muted)',
              marginTop: '6px',
            }}
          >
            Total pot:{' '}
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>
              {formatCurrency(potPreview)}
            </span>
          </p>
        )}
      </div>

      {/* Invite participants */}
      <div>
        <label
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--muted)',
            display: 'block',
            marginBottom: '8px',
          }}
        >
          Invite Participants
          {participants.length >= 9 && (
            <span style={{ color: 'var(--warning)', marginLeft: 8, textTransform: 'none', fontSize: '11px' }}>
              Max 9 reached
            </span>
          )}
        </label>

        {/* Selected chips */}
        {participants.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {participants.map((p) => (
              <span
                key={p.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '9999px',
                  padding: '4px 10px 4px 6px',
                  fontFamily: 'var(--font-dm)',
                  fontSize: '13px',
                  color: 'var(--text)',
                }}
              >
                <ParticipantAvatar
                  initials={getUsernameInitials(p.username)}
                  size={22}
                />
                @{p.username}
                <button
                  type="button"
                  onClick={() => removeParticipant(p.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    lineHeight: 1,
                    padding: 0,
                    marginLeft: 2,
                  }}
                  aria-label={`Remove ${p.username}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search input + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <Input
            placeholder="Search by username..."
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => setShowDropdown(true)}
            disabled={participants.length >= 9}
          />
          {showDropdown && filteredResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                marginTop: 4,
                zIndex: 20,
                overflow: 'hidden',
              }}
            >
              {filteredResults.slice(0, 6).map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => addParticipant(user)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 150ms',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      'rgba(255,255,255,0.04)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      'transparent'
                  }}
                >
                  <ParticipantAvatar
                    initials={getUsernameInitials(user.username)}
                    size={32}
                  />
                  <div>
                    <p
                      style={{
                        fontFamily: 'var(--font-dm)',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      {user.firstName} {user.lastName}
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-dm)',
                        fontSize: '12px',
                        color: 'var(--muted)',
                      }}
                    >
                      @{user.username}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--muted)',
            display: 'block',
            marginBottom: '10px',
          }}
        >
          Expiry Duration
        </label>
        <div className="flex gap-2">
          {DURATION_OPTIONS.map((opt) => {
            const selected = duration === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDuration(opt.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '9999px',
                  fontFamily: 'var(--font-dm)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: `1px solid ${selected ? 'transparent' : 'var(--border)'}`,
                  backgroundColor: selected ? 'var(--primary)' : 'var(--surface)',
                  color: selected ? '#0D0D0D' : 'var(--text)',
                  transition: 'background-color 150ms, color 150ms',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <p
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '13px',
            color: 'var(--danger)',
          }}
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={createBet.isPending}
        fullWidth
      >
        Create Bet
      </Button>
    </form>
  )
}
