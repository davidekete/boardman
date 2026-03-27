import { CreateBetForm } from '@/components/bets/CreateBetForm'

export default function NewBetPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1
        style={{
          fontFamily: 'var(--font-bebas)',
          fontSize: '40px',
          color: 'var(--text)',
          letterSpacing: '0.04em',
          lineHeight: 1,
        }}
      >
        NEW BET
      </h1>
      <div style={{ maxWidth: 560 }}>
        <CreateBetForm />
      </div>
    </div>
  )
}
