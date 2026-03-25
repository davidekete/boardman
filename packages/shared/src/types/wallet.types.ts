import { TransactionType } from './bet.types'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  reference: string | null
  betId: string | null
  createdAt: string
}

export interface WalletSummary {
  balance: number
  transactions: Transaction[]
}