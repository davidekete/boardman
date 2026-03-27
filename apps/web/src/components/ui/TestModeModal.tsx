'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface TestModeModalProps {
  isOpen: boolean
  onConfirm: () => Promise<void>
  onCancel: () => void
  title: string
  amount?: number
}

export function TestModeModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  amount,
}: TestModeModalProps) {
  const [visible, setVisible] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Animate in on mount, lock body scroll while open
  useEffect(() => {
    if (!isOpen) return
    const raf = requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(raf)
      setVisible(false)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  async function handleConfirm() {
    setConfirming(true)
    try {
      await onConfirm()
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          maxWidth: 440,
          width: '100%',
          padding: 32,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 150ms ease-out, opacity 150ms ease-out',
        }}
      >
        {/* Warning badge */}
        <div style={{ marginBottom: 16 }}>
          <span
            style={{
              display: 'inline-block',
              background: 'rgba(251,146,60,0.15)',
              color: 'var(--warning)',
              fontFamily: 'var(--font-dm)',
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.06em',
              padding: '4px 10px',
              borderRadius: 99,
            }}
          >
            ⚠ TEST MODE
          </span>
        </div>

        {/* Heading */}
        <p
          style={{
            fontFamily: 'var(--font-dm)',
            fontWeight: 700,
            fontSize: 20,
            color: 'var(--text)',
            margin: '0 0 8px',
          }}
        >
          {title}
        </p>

        {/* Amount (optional) */}
        {amount !== undefined && (
          <p
            style={{
              fontFamily: 'var(--font-bebas)',
              fontSize: 40,
              color: 'var(--text)',
              letterSpacing: '0.02em',
              lineHeight: 1,
              margin: '0 0 20px',
            }}
          >
            {formatCurrency(amount)}
          </p>
        )}

        {/* Warning block */}
        <div
          style={{
            background: 'rgba(251,146,60,0.08)',
            border: '1px solid rgba(251,146,60,0.2)',
            borderRadius: 6,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-dm)',
              fontSize: 14,
              color: 'var(--text)',
              margin: '0 0 8px',
            }}
          >
            Boardman is currently running in test mode. Your wallet balance will
            be debited but the funds will not be transferred to your bank
            account. This is expected behaviour during testing.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-dm)',
              fontSize: 13,
              color: 'var(--muted)',
              margin: 0,
            }}
          >
            Do not withdraw real funds you intend to receive during this period.
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            style={{
              width: '100%',
              padding: '14px 0',
              background: 'var(--primary)',
              color: '#0D0D0D',
              fontFamily: 'var(--font-dm)',
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              borderRadius: 4,
              cursor: confirming ? 'not-allowed' : 'pointer',
              opacity: confirming ? 0.7 : 1,
              transition: 'opacity 150ms',
            }}
          >
            {confirming ? 'Processing…' : 'I Understand, Proceed'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            style={{
              width: '100%',
              padding: '14px 0',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontFamily: 'var(--font-dm)',
              fontWeight: 400,
              fontSize: 14,
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: confirming ? 'not-allowed' : 'pointer',
              opacity: confirming ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
