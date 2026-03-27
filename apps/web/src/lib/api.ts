const BASE_URL = process.env.NEXT_PUBLIC_API_URL

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error((error as { message?: string }).message || 'Request failed')
  }
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error((error as { message?: string }).message || 'Request failed')
  }
  return res.json()
}

export const authApi = {
  register: (data: { firstName: string; lastName: string; username: string; email: string; password: string }) =>
    post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    post('/auth/login', data),
  logout: () => post('/auth/logout', {}),
  me: () => get('/auth/me'),
  completeProfile: (data: { username: string }) =>
    post('/auth/complete-profile', data),
  googleAuth: () => {
    window.location.href = `${BASE_URL}/auth/google`
  },
}

export interface WithdrawalAccount {
  id: string
  userId: string
  accountNumber: string
  accountName: string
  bankCode: string
  bankName: string
  createdAt: string
  updatedAt: string
}

export const walletApi = {
  getWallet: () => get('/wallet'),
  initiateDeposit: (amount: number) =>
    post<{ paymentUrl: string }>('/wallet/fund/initiate', { amount }),
  getVirtualAccount: () =>
    post<{ accountNumber: string; bankName: string; bankCode: string }>(
      '/wallet/fund/virtual-account',
      {},
    ),
  testFund: (amount: number) =>
    post<{ success: boolean; amount: number }>('/wallet/fund/test', { amount }),
  getWithdrawalAccount: () =>
    get<WithdrawalAccount | null>('/wallet/account'),
  inquireAccountName: (data: { accountNumber: string; bankCode: string }) =>
    post<{ accountName: string }>('/wallet/account/inquiry', data),
  saveWithdrawalAccount: (data: {
    accountNumber: string
    bankCode: string
    bankName: string
    accountName: string
  }) => post<WithdrawalAccount>('/wallet/account', data),
  withdraw: (amount: number) =>
    post<{ message: string; reference: string }>('/wallet/withdraw', { amount }),
}

export const betsApi = {
  create: (data: {
    title: string
    terms?: string
    stakeAmount: number
    participantUsernames: string[]
    expiresInDays: number
  }) => post('/bets', data),
  list: () => get('/bets'),
  getById: (id: string) => get(`/bets/${id}`),
  accept: (id: string) => post(`/bets/${id}/accept`, {}),
  decline: (id: string) => post(`/bets/${id}/decline`, {}),
  openVoting: (id: string) => post(`/bets/${id}/open-voting`, {}),
  vote: (id: string, winnerId: string) =>
    post(`/bets/${id}/vote`, { winnerId }),
  acceptByToken: (id: string, token: string) =>
    post(`/bets/${id}/accept-by-token`, { token }),
  voteCancel: (id: string) => post(`/bets/${id}/vote-cancel`, {}),
}

export const usersApi = {
  search: (username: string) =>
    get(`/users/search?username=${encodeURIComponent(username)}`),
}
