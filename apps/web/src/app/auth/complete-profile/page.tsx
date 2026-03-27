import { CompleteProfileForm } from './CompleteProfileForm'

export default function CompleteProfilePage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="w-full" style={{ maxWidth: 400 }}>
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '32px',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-dm)',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            One last thing
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-dm)',
              fontSize: '14px',
              color: 'var(--muted)',
              marginBottom: '24px',
            }}
          >
            Pick a username. This is how other players will find you.
          </p>
          <CompleteProfileForm />
        </div>
      </div>
    </div>
  )
}
