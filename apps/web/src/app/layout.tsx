import type { Metadata } from 'next'
import { Bebas_Neue, DM_Sans, JetBrains_Mono } from 'next/font/google'
import { QueryProvider } from '@/providers/QueryProvider'
import './globals.css'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Boardman',
  description: 'Your bets. Locked in.',
  openGraph: {
    title: 'Boardman',
    description: 'Your bets. Locked in.',
    siteName: 'Boardman',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Boardman',
    description: 'Your bets. Locked in.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      style={
        {
          '--font-bebas': bebasNeue.style.fontFamily,
          '--font-dm': dmSans.style.fontFamily,
          '--font-mono': jetbrainsMono.style.fontFamily,
        } as React.CSSProperties
      }
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
