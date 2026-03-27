interface ParticipantAvatarProps {
  initials: string
  size?: number
  title?: string
}

export function ParticipantAvatar({
  initials,
  size = 32,
  title,
}: ParticipantAvatarProps) {
  return (
    <span
      title={title}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        backgroundColor: 'var(--border)',
        color: 'var(--muted)',
        fontFamily: 'var(--font-dm)',
        fontWeight: 700,
        fontSize: size * 0.38,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textTransform: 'uppercase',
        userSelect: 'none',
        border: '1px solid var(--surface)',
      }}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  )
}
