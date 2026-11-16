# TURBO RUSH — Telegram Mini App MVP starter

This is an early playable frontend prototype built with React, TypeScript, Vite and Phaser 3.

## Included
- Telegram WebApp SDK bootstrap (`ready`, `expand`)
- Arcade lane-dodging race prototype with keyboard/pointer controls and nitro
- Garage with five sample car tiers
- Demo coins, local race rewards, leaderboard mockup and shop placeholder
- Responsive dark arcade UI

## Run locally
```bash
npm install
npm run dev
```
Open the Vite URL in a browser. For Telegram testing, deploy the frontend to an HTTPS host and set that URL as the Mini App URL through BotFather.

## Important prototype limitations
- Player balance, cars and race rewards are currently held only in React state. They reset on reload.
- The leaderboard is mock data.
- The shop is a placeholder. No payment is charged.
- There is no backend, authentication verification, anti-cheat, database, referral validation or real multiplayer yet.
- Before public release, validate Telegram `initData` on the server and make the server authoritative for balances, inventory, race results and payment fulfillment.
- Use Telegram Stars (`XTR`) for digital goods sold inside Telegram. Implement invoice creation, successful payment handling, idempotency, refunds and `/paysupport` before enabling purchases.

## Next implementation milestones
1. FastAPI backend + PostgreSQL schema and migrations.
2. Secure Telegram `initData` validation.
3. Server-side wallet ledger and inventory.
4. Server-authoritative race result validation and anti-cheat.
5. Referral deep links and verified referral rewards.
6. Telegram Stars invoice flow and payment reconciliation.
7. Real leaderboard and daily missions.
8. Production deployment, monitoring and privacy/support pages.

## Suggested environment variables (backend, future)
```env
BOT_TOKEN=
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...
WEBAPP_URL=https://your-domain.example
```
Never put `BOT_TOKEN` in frontend code or commit it to source control.
