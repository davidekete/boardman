'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { authApi } from '@/lib/api'

export function CompleteProfileForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.completeProfile({ username })
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set username')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Username"
        placeholder="johndoe"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        autoComplete="username"
        autoFocus
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
        Set Username
      </Button>
    </form>
  )
}
