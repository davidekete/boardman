# Boardman

> Peer-to-peer betting escrow -- stake it, match it, settle it.

**Team Code:** `c7087b`

---

## What is Boardman?

Boardman is a peer-to-peer betting escrow platform that lets two parties create, fund, and settle bets without trusting each other or a centralised bookmaker. Stakes are locked in escrow at bet creation and released to the winner on outcome confirmation.

---

## Live Demo

**URL:** https://boardman.live

**Test Credentials:**

| Role | Email | Password |
|------|-------|----------|
| User A | `tester.alpha@maildrop.cc` | `Password123` |
| User B | `tester.beta@maildrop.cc` | `Password123` |

> Use these accounts to simulate a full bet lifecycle: create a bet on one account, join it from the second, and settle the outcome.

---

## Core Features

- **Bet creation** -- define terms, stake amount, and expiry window
- **Escrow wallet** -- funds locked on both sides before a bet goes live
- **Outcome settlement** -- winner claims escrowed funds on confirmation
- **Time-based expiry** -- unmatched bets expire automatically when the window closes
- **Automatic refunds** -- escrowed funds returned to both parties if a bet expires or is cancelled
- **Interswitch payment integration** -- fund your wallet and withdraw winnings via Interswitch

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (React), deployed on Vercel |
| Backend | NestJS, deployed on Render |
| Database | PostgreSQL (Neon) |
| Payments | Interswitch API |

---

## Repository Structure

```
boardman/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS backend
├── packages/         # Shared types, utilities
└── README.md
```

> This is a monorepo. Both the frontend and backend live in this repository.

---

## Accessing the App

No local setup needed. The app is fully deployed and accessible at **https://boardman.live**.

Use the test credentials above to explore the full bet lifecycle.

---

## How a Bet Works

```
Creator sets terms + stakes funds
        ↓
Bet enters open pool (timer starts)
        ↓
  ┌─────┴─────┐
Joined     Timer expires
  ↓              ↓
Both sides    Funds refunded
locked in     to creator
  ↓
Outcome reported
  ↓
Winner collects escrowed funds
```

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

> **Note on repository creation date:** This repository was created during an initial registration attempt that was not completed. As a result, the repo creation date may not match the final registration date -- however, no code was pushed before the buildathon commenced. The full commit history reflects development that took place entirely within the buildathon window.

---

*Questions or issues with the demo? Reach out to me [David Ekete] via the buildathon community channel.*