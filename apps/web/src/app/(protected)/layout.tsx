'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMe } from '@/lib/queries'
import { AppShell } from '@/components/layout/AppShell'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { data: user, isError, isLoading } = useMe()

  useEffect(() => {
    if (isLoading) return
    if (isError) {
      router.replace('/auth/login')
      return
    }
    if (user && !user.isOnboarded) {
      router.replace('/auth/complete-profile')
    }
  }, [isLoading, isError, user, router])

  // Keep the dark screen visible while any redirect is in flight —
  // returning null here would flash a blank white screen.
  if (isLoading || isError || !user || !user.isOnboarded) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--bg)',
        }}
      />
    )
  }

  return <AppShell>{children}</AppShell>
}
