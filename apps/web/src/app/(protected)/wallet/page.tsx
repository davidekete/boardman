'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { TransactionType } from '@boardman/shared'
import { useWallet, useInitiateDeposit } from '@/lib/queries'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils'

export default function WalletPage() {
  const searchParams = useSearchParams()
  const { data: wallet } = useWallet()
  const initiateDeposit = useInitiateDeposit()

  const [fundExpanded, setFundExpanded] = useState(false)
  const [amount, setAmount] = useState('')
  const [fundError, setFundError] = useState('')

  const [bannerVisible, setBannerVisible] = useState(false)
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchParams.get('funded') === 'true') {
      setBannerVisible(true)
      bannerTimer.current = setTimeout(() => setBannerVisible(false), 4000)
    }
    return () => { if (bannerTimer.current) clearTimeout(bannerTimer.current) }
  }, [searchParams])

  async function handleFund() {
    setFundError('')
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) {
      setFundError('Enter a valid amount')
      return
    }
    try {
      const { paymentUrl } = await initiateDeposit.mutateAsync(parsed)
      window.location.href = paymentUrl
    } catch (err) {
      setFundError(err instanceof Error ? err.message : 'Failed to initiate deposit')
    }
  }

  return (
    <div className="flex flex-col gap-8" style={{ maxWidth: 560 }}>
      {/* Success banner */}
      {bannerVisible && (
        <div
          style={{
            backgroundColor: 'rgba(74,222,128,0.12)',
            border: '1px solid rgba(74,222,128,0.3)',
            borderRadius: '6px',
            padding: '12px 16px',
            fontFamily: 'var(--font-dm)',
            fontSize: '14px',
            color: 'var(--success)',
            fontWeight: 600,
          }}
        >
          Wallet funded successfully
        </div>
      )}

      {/* Page title + balance */}
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: '40px',
            color: 'var(--text)',
            letterSpacing: '0.04em',
            lineHeight: 1,
            marginBottom: '8px',
          }}
        >
          WALLET
        </h1>
        <BalanceDisplay amount={wallet?.balance ?? 0} />
      </div>

      {/* Fund wallet section */}
      <div>
        {!fundExpanded ? (
          <Button variant="primary" size="md" onClick={() => setFundExpanded(true)}>
            Fund Wallet
          </Button>
        ) : (
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <Input
              label="Amount"
              type="number"
              placeholder="5000"
              prefix="₦"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="100"
              error={fundError || undefined}
              autoFocus
            />
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="md"
                loading={initiateDeposit.isPending}
                onClick={handleFund}
              >
                Proceed
              </Button>
              <button
                type="button"
                onClick={() => { setFundExpanded(false); setAmount(''); setFundError('') }}
                style={{
                  fontFamily: 'var(--font-dm)',
                  fontSize: '13px',
                  color: 'var(--muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction history */}
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
          Transaction History
        </h2>

        {!wallet?.transactions?.length ? (
          <EmptyState label="NO TRANSACTIONS YET" />
        ) : (
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              overflow: 'hidden',
            }}
          >
            {wallet.transactions.map((tx, i) => {
              const isCredit = [
                TransactionType.DEPOSIT,
                TransactionType.ESCROW_RELEASE,
                TransactionType.REFUND,
              ].includes(tx.type)

              return (
                <div
                  key={tx.id}
                  style={{
                    padding: '14px 16px',
                    borderBottom:
                      i < wallet.transactions.length - 1
                        ? '1px solid var(--border)'
                        : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontFamily: 'var(--font-dm)',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text)',
                        marginBottom: '2px',
                      }}
                    >
                      {txLabel(tx.type)}
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-dm)',
                        fontSize: '12px',
                        color: 'var(--muted)',
                      }}
                    >
                      {tx.reference ?? (tx.betId ? `Bet #${tx.betId.slice(-6)}` : '—')}
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--muted)',
                        marginTop: '4px',
                      }}
                    >
                      {new Date(tx.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: isCredit ? 'var(--success)' : 'var(--danger)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isCredit ? '+' : '-'}
                    {formatCurrency(tx.amount)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function txLabel(type: TransactionType): string {
  const labels: Record<TransactionType, string> = {
    [TransactionType.DEPOSIT]: 'Deposit',
    [TransactionType.ESCROW_LOCK]: 'Escrow Lock',
    [TransactionType.ESCROW_RELEASE]: 'Escrow Release',
    [TransactionType.REFUND]: 'Refund',
    [TransactionType.FEE]: 'Fee',
  }
  return labels[type] ?? type
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
