'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { authApi } from '@/lib/api'

export function RegisterForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.register(form)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-3">
        <Input
          label="First Name"
          placeholder="John"
          value={form.firstName}
          onChange={set('firstName')}
          required
        />
        <Input
          label="Last Name"
          placeholder="Doe"
          value={form.lastName}
          onChange={set('lastName')}
          required
        />
      </div>
      <Input
        label="Username"
        placeholder="johndoe"
        value={form.username}
        onChange={set('username')}
        required
        autoComplete="username"
      />
      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={form.email}
        onChange={set('email')}
        required
        autoComplete="email"
      />
      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        value={form.password}
        onChange={set('password')}
        required
        autoComplete="new-password"
      />

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

      <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth>
        Create Account
      </Button>

      <div className="flex items-center gap-3">
        <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
        <span
          style={{
            fontFamily: 'var(--font-dm)',
            fontSize: '12px',
            color: 'var(--muted)',
          }}
        >
          or
        </span>
        <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
      </div>

      <Button
        type="button"
        variant="surface"
        size="lg"
        fullWidth
        onClick={() => authApi.googleAuth()}
      >
        <GoogleIcon />
        Continue with Google
      </Button>
    </form>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}
