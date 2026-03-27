import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div
        className="w-full"
        style={{ maxWidth: 400 }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            style={{
              fontFamily: 'var(--font-bebas)',
              fontSize: '48px',
              color: 'var(--primary)',
              letterSpacing: '0.06em',
              lineHeight: 1,
            }}
          >
            BOARDMAN
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-dm)',
              fontSize: '14px',
              color: 'var(--muted)',
              marginTop: '6px',
            }}
          >
            Your bets. Locked in.
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '28px',
          }}
        >
          <LoginForm />
        </div>

        <p
          className="text-center mt-5"
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '13px',
            color: 'var(--muted)',
          }}
        >
          Don&apos;t have an account?{' '}
          <a
            href="/auth/register"
            style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  )
}
