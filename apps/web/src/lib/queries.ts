import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi, walletApi, betsApi, usersApi } from './api'
import type { Bet, WalletSummary } from '@boardman/shared'

export interface User {
  id: string
  firstName: string
  lastName: string
  username: string
  email: string
  isOnboarded: boolean
}

export interface SearchedUser {
  id: string
  firstName: string
  lastName: string
  username: string
}

export const useMe = () =>
  useQuery<User>({
    queryKey: ['me'],
    queryFn: () => authApi.me() as Promise<User>,
    retry: false,
  })

export const useWallet = () =>
  useQuery<WalletSummary>({
    queryKey: ['wallet'],
    queryFn: () => walletApi.getWallet() as Promise<WalletSummary>,
  })

export const useBets = () =>
  useQuery<Bet[]>({
    queryKey: ['bets'],
    queryFn: () => betsApi.list() as Promise<Bet[]>,
  })

export const useBet = (id: string) =>
  useQuery<Bet>({
    queryKey: ['bet', id],
    queryFn: () => betsApi.getById(id) as Promise<Bet>,
  })

export const useUserSearch = (query: string) =>
  useQuery<SearchedUser[]>({
    queryKey: ['users', query],
    queryFn: () => usersApi.search(query) as Promise<SearchedUser[]>,
    enabled: query.length >= 2,
  })

export const useCreateBet = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: betsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bets'] })
    },
  })
}

export const useAcceptBet = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => betsApi.accept(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['bets'] })
      queryClient.invalidateQueries({ queryKey: ['bet', id] })
    },
  })
}

export const useDeclineBet = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => betsApi.decline(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['bets'] })
      queryClient.invalidateQueries({ queryKey: ['bet', id] })
    },
  })
}

export const useOpenVoting = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => betsApi.openVoting(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['bet', id] })
      queryClient.invalidateQueries({ queryKey: ['bets'] })
    },
  })
}

export const useVote = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ betId, winnerId }: { betId: string; winnerId: string }) =>
      betsApi.vote(betId, winnerId),
    onSuccess: (_data, { betId }) => {
      queryClient.invalidateQueries({ queryKey: ['bet', betId] })
      queryClient.invalidateQueries({ queryKey: ['bets'] })
    },
  })
}

export const useInitiateDeposit = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (amount: number) => walletApi.initiateDeposit(amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
    },
  })
}
