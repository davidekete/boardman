'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/bets', label: 'Bets' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/profile', label: 'Profile' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="hidden md:flex flex-col shrink-0"
      style={{
        width: 240,
        backgroundColor: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: '28px',
            color: 'var(--primary)',
            letterSpacing: '0.06em',
          }}
        >
          BOARDMAN
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: '6px',
                fontFamily: 'var(--font-dm)',
                fontSize: '14px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--primary)' : 'var(--muted)',
                backgroundColor: isActive ? 'rgba(232,255,71,0.06)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                textDecoration: 'none',
                transition: 'color 150ms, background-color 150ms',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
