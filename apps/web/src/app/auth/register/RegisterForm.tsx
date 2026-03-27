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

    </form>
  )
}
