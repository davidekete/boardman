# Boardman

> Peer-to-peer betting escrow — stake it, lock it, settle it.

**Team Code:** `c7087b`

---

## What is Boardman?

Boardman is a peer-to-peer betting escrow platform. Two or more parties create a bet, each side locks their stake into escrow, and the winner collects when the outcome is confirmed. No bookmaker, no trust required.

---

## Live Demo

**URL:** https://boardman.live

**Test Credentials:**

| Role | Email | Password |
|------|-------|----------|
| User A | `tester.alpha@maildrop.cc` | `Password123` |
| User B | `tester.beta@maildrop.cc` | `Password123` |

> Use both accounts to simulate a full bet lifecycle: create a bet on User A, accept it on User B, then settle the outcome.

---

## Core Features

- **Invite-only bets** — creator specifies participants by username; no open pool
- **Email invites** — participants receive an invite email and can accept directly from it
- **Escrow wallet** — both sides' stakes are locked before the bet goes live
- **Voting-based settlement** — creator marks the event done, all participants vote on the winner; unanimous vote releases funds
- **Dispute handling** — if votes don't agree, the bet is flagged for review
- **Early exit** — any participant can request to cancel a live bet; if all agree, stakes are refunded immediately
- **Automatic expiry refunds** — if a bet expires before everyone has accepted or before it is settled, all locked stakes are returned automatically (hourly cron)
- **Interswitch payments** — fund your wallet via hosted checkout or virtual bank account (Wema Bank); withdraw winnings to any Nigerian bank account
- **Platform fee** — a small percentage is deducted from winnings on settlement

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (React), deployed on Vercel |
| Backend | NestJS, deployed on Render |
| Database | PostgreSQL (Neon) |
| Payments | Interswitch API (deposits + withdrawals) |
| Email | Brevo (transactional emails) |

---

## Repository Structure

```
boardman/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS backend
├── packages/         # Shared types and utilities
└── README.md
```

> This is a pnpm monorepo. Both the frontend and backend live in this repository.

---

## Accessing the App

No local setup needed. The app is fully deployed at **[boardman.live](https://boardman.live)**.

Use the test credentials above to explore the full bet lifecycle.

---

## How a Bet Works

```
Creator sets terms, stake, and invites participants by username
        ↓
Invite emails sent — participants can accept from email or in-app
        ↓
  ┌─────┴──────────────────┐
All accept                 Anyone declines / bet expires
  ↓                              ↓
Bet goes ACTIVE         All stakes refunded to participants
  ↓
Creator marks event as done
        ↓
All participants vote on the winner
        ↓
  ┌─────┴──────────────────┐
Unanimous vote            Votes disagree
  ↓                              ↓
Winner receives          Bet flagged as DISPUTED
escrowed funds           (minus platform fee)
```

> At any point while a bet is ACTIVE, all participants can mutually agree to exit early — stakes are refunded immediately.

---

## Bet Lifecycle States

| Status | Meaning |
|--------|---------|
| `PENDING` | Created, waiting for all invited participants to accept |
| `ACTIVE` | All participants accepted; event is in progress |
| `VOTING` | Creator marked the event done; participants are voting |
| `SETTLED` | Unanimous vote reached; winner paid out |
| `DISPUTED` | Votes disagreed; under review |
| `REFUNDED` | Bet cancelled or expired; all stakes returned |

---

## Team

| Name | Role |
|------|------|
| David Ekete | Fullstack Developer |
| Barth Afam Anadu | Designer |

---

## Built During

Enyata x Interswitch Developer Community Buildathon, 2025.
This project was built entirely within the buildathon period and has not been previously developed, submitted, or published.

> **Note on repository creation date:** This repository was created during an initial registration attempt that was not completed. As a result, the repo creation date may not match the final registration date — however, no code was pushed before the buildathon commenced. The full commit history reflects development that took place entirely within the buildathon window.

---

*Questions or issues with the demo? Reach out to me [David Ekete] via the buildathon community channel.*
