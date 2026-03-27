import { BetDetailPanel } from '@/components/bets/BetDetailPanel'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return { title: `Bet ${id.slice(-6)} — Boardman` }
}

export default async function BetPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <BetDetailPanel id={id} />
}
