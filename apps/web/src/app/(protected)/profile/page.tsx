'use client'

import { useMe } from '@/lib/queries'
import { authApi } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ParticipantAvatar } from '@/components/ui/ParticipantAvatar'
import { getInitials } from '@/lib/utils'
import { useState } from 'react'

export default function ProfilePage() {
  const { data: user } = useMe()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try {
      await authApi.logout()
      router.replace('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col gap-8" style={{ maxWidth: 400 }}>
      <h1
        style={{
          fontFamily: 'var(--font-bebas)',
          fontSize: '40px',
          color: 'var(--text)',
          letterSpacing: '0.04em',
          lineHeight: 1,
        }}
      >
        PROFILE
      </h1>

      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div className="flex items-center gap-4">
          <ParticipantAvatar
            initials={getInitials(user.firstName, user.lastName)}
            size={56}
          />
          <div>
            <p
              style={{
                fontFamily: 'var(--font-dm)',
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              {user.firstName} {user.lastName}
            </p>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: 'var(--muted)',
              }}
            >
              @{user.username}
            </p>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <p
            style={{
              fontFamily: 'var(--font-dm)',
              fontSize: '12px',
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '4px',
            }}
          >
            Email
          </p>
          <p
            style={{
              fontFamily: 'var(--font-dm)',
              fontSize: '14px',
              color: 'var(--text)',
            }}
          >
            {user.email}
          </p>
        </div>
      </div>

      <Button
        variant="danger"
        size="md"
        loading={loading}
        onClick={handleLogout}
      >
        Sign Out
      </Button>
    </div>
  )
}
