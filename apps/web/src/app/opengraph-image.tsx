import { ImageResponse } from 'next/og'

export const alt = 'Boardman — Your bets. Locked in.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0D0D0D',
          padding: '80px',
        }}
      >
        <p
          style={{
            fontSize: '140px',
            fontWeight: 900,
            color: '#E8FF47',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            margin: 0,
          }}
        >
          BOARDMAN
        </p>
        <p
          style={{
            fontSize: '36px',
            color: '#6B6B6B',
            letterSpacing: '0.08em',
            marginTop: '24px',
            textTransform: 'uppercase',
          }}
        >
          Your bets. Locked in.
        </p>
      </div>
    ),
    { ...size },
  )
}
