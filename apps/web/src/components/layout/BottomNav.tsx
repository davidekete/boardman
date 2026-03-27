'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/bets', label: 'Bets' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/profile', label: 'Profile' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="flex md:hidden items-center"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        backgroundColor: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        zIndex: 50,
      }}
    >
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + '/')

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              height: '100%',
              textDecoration: 'none',
              color: isActive ? 'var(--primary)' : 'var(--muted)',
              fontFamily: 'var(--font-dm)',
              fontSize: '11px',
              fontWeight: isActive ? 700 : 500,
              transition: 'color 150ms',
            }}
          >
            <span style={{ fontSize: '20px' }}>
              {item.href === '/dashboard' && '◉'}
              {item.href === '/bets' && '◈'}
              {item.href === '/wallet' && '◎'}
              {item.href === '/profile' && '◌'}
            </span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
