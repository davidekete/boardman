'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { TransactionType } from '@boardman/shared'
import {
  useWallet,
  useInitiateDeposit,
  useGetVirtualAccount,
  useTestFund,
  useWithdrawalAccount,
  useAccountNameInquiry,
  useSaveWithdrawalAccount,
  useWithdraw,
} from '@/lib/queries'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { TestModeModal } from '@/components/ui/TestModeModal'
import { formatCurrency } from '@/lib/utils'

type FundMethod = 'paybill' | 'virtual'

export default function WalletPage() {
  const searchParams = useSearchParams()
  const { data: wallet, refetch: refetchWallet } = useWallet()
  const initiateDeposit = useInitiateDeposit()
  const getVirtualAccount = useGetVirtualAccount()
  const testFund = useTestFund()

  // Funding method toggle
  const [method, setMethod] = useState<FundMethod>('paybill')

  // Pay Bill state
  const [amount, setAmount] = useState('')
  const [payBillError, setPayBillError] = useState('')

  // Virtual account state
  const [vaError, setVaError] = useState('')
  const [copied, setCopied] = useState(false)

  // Test fund state
  const [testAmount, setTestAmount] = useState('')
  const [testError, setTestError] = useState('')
  const [testSuccess, setTestSuccess] = useState(false)

  // Success banner
  const [bannerVisible, setBannerVisible] = useState(false)
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchParams.get('funded') === 'true') {
      setBannerVisible(true)
      bannerTimer.current = setTimeout(() => setBannerVisible(false), 4000)
    }
    return () => { if (bannerTimer.current) clearTimeout(bannerTimer.current) }
  }, [searchParams])

  // Reset errors when switching method
  function switchMethod(m: FundMethod) {
    setMethod(m)
    setPayBillError('')
    setVaError('')
    setTestError('')
    setTestSuccess(false)
  }

  async function handlePayBill() {
    setPayBillError('')
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) { setPayBillError('Enter a valid amount'); return }
    try {
      const { paymentUrl } = await initiateDeposit.mutateAsync(parsed)
      window.location.href = paymentUrl
    } catch (err) {
      setPayBillError(err instanceof Error ? err.message : 'Failed to initiate payment')
    }
  }

  async function handleGetVirtualAccount() {
    setVaError('')
    try {
      await getVirtualAccount.mutateAsync()
    } catch (err) {
      setVaError(err instanceof Error ? err.message : 'Failed to get virtual account')
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleTestFund() {
    setTestError('')
    setTestSuccess(false)
    const parsed = parseFloat(testAmount)
    if (!parsed || parsed <= 0) { setTestError('Enter a valid amount'); return }
    try {
      await testFund.mutateAsync(parsed)
      setTestAmount('')
      setTestSuccess(true)
      refetchWallet()
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Failed to add test funds')
    }
  }

  const va = getVirtualAccount.data
  const vaFailed = !!vaError

  // ── Withdrawal ─────────────────────────────────────────────────────────────

  const { data: savedAccount, refetch: refetchAccount } = useWithdrawalAccount()
  const accountNameInquiry = useAccountNameInquiry()
  const saveWithdrawalAccount = useSaveWithdrawalAccount()
  const withdraw = useWithdraw()

  // Account setup state
  const [inquiryAccountNumber, setInquiryAccountNumber] = useState('')
  const [inquiryBankCode, setInquiryBankCode] = useState('')
  const [inquiryBankName, setInquiryBankName] = useState('')
  const [inquiredName, setInquiredName] = useState<string | null>(null)
  const [inquiryError, setInquiryError] = useState('')
  const [saveAccountError, setSaveAccountError] = useState('')

  // Withdrawal form state
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawError, setWithdrawError] = useState('')
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)
  const [showTestModeModal, setShowTestModeModal] = useState(false)
  const [pendingWithdrawAmount, setPendingWithdrawAmount] = useState(0)

  async function handleInquiry() {
    setInquiryError('')
    setInquiredName(null)
    if (inquiryAccountNumber.length !== 10) {
      setInquiryError('Account number must be 10 digits')
      return
    }
    if (!inquiryBankCode.trim()) {
      setInquiryError('Bank code is required')
      return
    }
    try {
      const { accountName } = await accountNameInquiry.mutateAsync({
        accountNumber: inquiryAccountNumber,
        bankCode: inquiryBankCode,
      })
      setInquiredName(accountName)
    } catch (err) {
      setInquiryError(err instanceof Error ? err.message : 'Account not found')
    }
  }

  async function handleSaveAccount() {
    setSaveAccountError('')
    if (!inquiredName) return
    try {
      await saveWithdrawalAccount.mutateAsync({
        accountNumber: inquiryAccountNumber,
        bankCode: inquiryBankCode,
        bankName: inquiryBankName,
        accountName: inquiredName,
      })
      setInquiryAccountNumber('')
      setInquiryBankCode('')
      setInquiryBankName('')
      setInquiredName(null)
      refetchAccount()
    } catch (err) {
      setSaveAccountError(err instanceof Error ? err.message : 'Failed to save account')
    }
  }

  function handleWithdrawClick() {
    setWithdrawError('')
    setWithdrawSuccess(false)
    const parsed = parseFloat(withdrawAmount)
    if (!parsed || parsed < 500) {
      setWithdrawError('Minimum withdrawal is ₦500')
      return
    }
    setPendingWithdrawAmount(parsed)
    setShowTestModeModal(true)
  }

  async function handleWithdrawConfirm() {
    try {
      await withdraw.mutateAsync(pendingWithdrawAmount)
      setWithdrawAmount('')
      setWithdrawSuccess(true)
      setShowTestModeModal(false)
      refetchWallet()
    } catch (err) {
      setShowTestModeModal(false)
      setWithdrawError(err instanceof Error ? err.message : 'Withdrawal failed')
    }
  }

  return (
    <div className="flex flex-col gap-8" style={{ maxWidth: 560 }}>

      {/* Success banner */}
      {bannerVisible && (
        <div style={{
          backgroundColor: 'rgba(74,222,128,0.12)',
          border: '1px solid rgba(74,222,128,0.3)',
          borderRadius: 6,
          padding: '12px 16px',
          fontFamily: 'var(--font-dm)',
          fontSize: 14,
          color: 'var(--success)',
          fontWeight: 600,
        }}>
          Wallet funded successfully
        </div>
      )}

      {/* Title + balance */}
      <div>
        <h1 style={{
          fontFamily: 'var(--font-bebas)',
          fontSize: 40,
          color: 'var(--text)',
          letterSpacing: '0.04em',
          lineHeight: 1,
          marginBottom: 8,
        }}>
          WALLET
        </h1>
        <BalanceDisplay amount={wallet?.balance ?? 0} />
      </div>

      {/* Fund wallet card */}
      <div style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        {/* Method toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {([['paybill', 'Pay Online'], ['virtual', 'Bank Transfer']] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMethod(m)}
              style={{
                flex: 1,
                padding: '12px 0',
                fontFamily: 'var(--font-dm)',
                fontSize: 13,
                fontWeight: 700,
                background: 'none',
                border: 'none',
                borderBottom: method === m ? '2px solid var(--primary)' : '2px solid transparent',
                color: method === m ? 'var(--primary)' : 'var(--muted)',
                cursor: 'pointer',
                marginBottom: -1,
                transition: 'color 150ms, border-color 150ms',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>

          {/* ── Pay Online ── */}
          {method === 'paybill' && (
            <div className="flex flex-col gap-4">
              <p style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--muted)' }}>
                You&apos;ll be redirected to Interswitch&apos;s secure payment page.
              </p>
              <Input
                label="Amount"
                type="number"
                placeholder="5000"
                prefix="₦"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                error={payBillError || undefined}
              />
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={initiateDeposit.isPending}
                onClick={handlePayBill}
              >
                Proceed to Payment
              </Button>
            </div>
          )}

          {/* ── Bank Transfer ── */}
          {method === 'virtual' && (
            <div className="flex flex-col gap-4">

              {/* Not yet fetched */}
              {!va && !vaFailed && (
                <>
                  <p style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--muted)' }}>
                    Get a dedicated bank account number. Transfer any amount and your wallet is credited automatically.
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    loading={getVirtualAccount.isPending}
                    onClick={handleGetVirtualAccount}
                  >
                    Get Account Details
                  </Button>
                </>
              )}

              {/* Success — show account details */}
              {va && !vaFailed && (
                <div className="flex flex-col gap-3">
                  <p style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--muted)' }}>
                    Transfer any amount to this account. Your wallet will be credited automatically.
                  </p>
                  <div style={{
                    backgroundColor: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-dm)', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Bank</p>
                      <p style={{ fontFamily: 'var(--font-dm)', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{va.bankName}</p>
                    </div>
                    <div>
                      <p style={{ fontFamily: 'var(--font-dm)', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Account Number</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.06em' }}>
                          {va.accountNumber}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCopy(va.accountNumber)}
                          style={{
                            fontFamily: 'var(--font-dm)',
                            fontSize: 11,
                            fontWeight: 700,
                            color: copied ? 'var(--success)' : 'var(--muted)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                          }}
                        >
                          {copied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error — show fallback test funds */}
              {vaFailed && (
                <div className="flex flex-col gap-4">
                  <div style={{
                    backgroundColor: 'rgba(248,113,113,0.08)',
                    border: '1px solid rgba(248,113,113,0.2)',
                    borderRadius: 6,
                    padding: '12px 14px',
                  }}>
                    <p style={{ fontFamily: 'var(--font-dm)', fontSize: 14, fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>
                      Sorry, our provider (Interswitch) could not process your request.
                    </p>
                    <p style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--muted)' }}>
                      In the meantime, you can fund your account using test funds.
                    </p>
                  </div>

                  <Input
                    label="Test Amount"
                    type="number"
                    placeholder="5000"
                    prefix="₦"
                    value={testAmount}
                    onChange={(e) => setTestAmount(e.target.value)}
                    min="1"
                    error={testError || undefined}
                  />

                  {testSuccess && (
                    <p style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                      Test funds added successfully.
                    </p>
                  )}

                  <Button
                    variant="surface"
                    size="md"
                    fullWidth
                    loading={testFund.isPending}
                    onClick={handleTestFund}
                    style={{ color: 'var(--warning)' } as React.CSSProperties}
                  >
                    Add Test Funds
                  </Button>

                  <button
                    type="button"
                    onClick={() => { setVaError(''); getVirtualAccount.reset() }}
                    style={{
                      fontFamily: 'var(--font-dm)',
                      fontSize: 12,
                      color: 'var(--muted)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      textAlign: 'left',
                    }}
                  >
                    ← Try again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Withdraw card ─────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--font-dm)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text)',
        }}>
          Withdraw
        </div>

        <div style={{ padding: 20 }} className="flex flex-col gap-4">

          {/* ── No saved account — setup form ── */}
          {savedAccount === null && (
            <>
              <p style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--muted)' }}>
                Add a bank account to withdraw your winnings.
              </p>

              <Input
                label="Account Number"
                type="text"
                placeholder="0123456789"
                value={inquiryAccountNumber}
                onChange={(e) => {
                  setInquiryAccountNumber(e.target.value)
                  setInquiredName(null)
                }}
                maxLength={10}
              />
              <Input
                label="Bank Code"
                type="text"
                placeholder="e.g. 058 for GTBank"
                value={inquiryBankCode}
                onChange={(e) => {
                  setInquiryBankCode(e.target.value)
                  setInquiredName(null)
                }}
              />
              <Input
                label="Bank Name"
                type="text"
                placeholder="e.g. GTBank"
                value={inquiryBankName}
                onChange={(e) => setInquiryBankName(e.target.value)}
              />

              {inquiryError && (
                <p style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--danger)' }}>
                  {inquiryError}
                </p>
              )}

              {inquiredName && (
                <div style={{
                  backgroundColor: 'rgba(232,255,71,0.06)',
                  border: '1px solid rgba(232,255,71,0.2)',
                  borderRadius: 6,
                  padding: '12px 14px',
                }}>
                  <p style={{ fontFamily: 'var(--font-dm)', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    Account Name
                  </p>
                  <p style={{ fontFamily: 'var(--font-dm)', fontSize: 15, fontWeight: 600, color: 'var(--primary)' }}>
                    {inquiredName}
                  </p>
                </div>
              )}

              {saveAccountError && (
                <p style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--danger)' }}>
                  {saveAccountError}
                </p>
              )}

              {!inquiredName ? (
                <Button
                  variant="surface"
                  size="md"
                  fullWidth
                  loading={accountNameInquiry.isPending}
                  onClick={handleInquiry}
                >
                  Check Account Name
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  loading={saveWithdrawalAccount.isPending}
                  onClick={handleSaveAccount}
                >
                  Save Account
                </Button>
              )}
            </>
          )}

          {/* ── Saved account — withdrawal form ── */}
          {savedAccount && (
            <>
              {/* Saved account details */}
              <div style={{
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-dm)', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                    {savedAccount.accountName}
                  </p>
                  <p style={{ fontFamily: 'var(--font-dm)', fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>
                    {savedAccount.bankName}
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
                    •••• •••• {savedAccount.accountNumber.slice(-4)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInquiryAccountNumber('')
                    setInquiryBankCode('')
                    setInquiryBankName('')
                    setInquiredName(null)
                    // Optimistically clear to show setup form
                    refetchAccount()
                  }}
                  style={{
                    fontFamily: 'var(--font-dm)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    flexShrink: 0,
                  }}
                >
                  Change
                </button>
              </div>

              <Input
                label="Amount"
                type="number"
                placeholder="1000"
                prefix="₦"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                min="500"
                error={withdrawError || undefined}
              />

              {withdrawSuccess && (
                <p style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                  Withdrawal submitted successfully.
                </p>
              )}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleWithdrawClick}
              >
                Withdraw
              </Button>
            </>
          )}

          {/* Loading state while fetching saved account */}
          {savedAccount === undefined && (
            <p style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--muted)' }}>
              Loading…
            </p>
          )}
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <h2 style={{
          fontFamily: 'var(--font-dm)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 16,
        }}>
          Transaction History
        </h2>

        {!wallet?.transactions?.length ? (
          <EmptyState label="NO TRANSACTIONS YET" />
        ) : (
          <div style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            overflow: 'hidden',
          }}>
            {wallet.transactions.map((tx, i) => {
              const isCredit = [
                TransactionType.DEPOSIT,
                TransactionType.ESCROW_RELEASE,
                TransactionType.REFUND,
              ].includes(tx.type)

              return (
                <div key={tx.id} style={{
                  padding: '14px 16px',
                  borderBottom: i < wallet.transactions.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-dm)', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                      {txLabel(tx.type)}
                    </p>
                    <p style={{ fontFamily: 'var(--font-dm)', fontSize: 12, color: 'var(--muted)' }}>
                      {tx.reference ?? (tx.betId ? `Bet #${tx.betId.slice(-6)}` : '—')}
                    </p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      {new Date(tx.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: isCredit ? 'var(--success)' : 'var(--danger)',
                    whiteSpace: 'nowrap',
                  }}>
                    {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Test mode withdrawal modal */}
      <TestModeModal
        isOpen={showTestModeModal}
        title="Your wallet will be debited"
        amount={pendingWithdrawAmount}
        onConfirm={handleWithdrawConfirm}
        onCancel={() => setShowTestModeModal(false)}
      />
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
    [TransactionType.WITHDRAWAL]: 'Withdrawal',
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
      if (progress < 1) { rafRef.current = requestAnimationFrame(step) }
      else { setDisplayed(amount) }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [amount])

  return (
    <p style={{
      fontFamily: 'var(--font-bebas)',
      fontSize: 64,
      color: 'var(--text)',
      lineHeight: 1,
      letterSpacing: '0.02em',
    }}>
      {formatCurrency(displayed)}
    </p>
  )
}
