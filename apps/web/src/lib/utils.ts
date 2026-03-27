export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amount)
}

export function getCountdown(expiresAt: string): {
  text: string
  urgency: 'normal' | 'warning' | 'danger'
} {
  const diff = new Date(expiresAt).getTime() - Date.now()

  if (diff <= 0) {
    return { text: 'Expired', urgency: 'danger' }
  }

  const totalMinutes = Math.floor(diff / 1000 / 60)
  const totalHours = Math.floor(totalMinutes / 60)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  const minutes = totalMinutes % 60

  if (diff < 60 * 60 * 1000) {
    return { text: `${totalMinutes}m`, urgency: 'danger' }
  }

  if (diff < 24 * 60 * 60 * 1000) {
    return { text: `${totalHours}h ${minutes}m`, urgency: 'warning' }
  }

  return { text: `${days}d ${hours}h`, urgency: 'normal' }
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function getPotAmount(stakeAmount: number, count: number): number {
  return stakeAmount * count
}

export function getUsernameInitials(username: string): string {
  return username.slice(0, 2).toUpperCase()
}
