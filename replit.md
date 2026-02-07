# Continuous Profit Engine

## Overview

This is a **cryptocurrency trading simulation dashboard** — a full-stack web application that simulates high-frequency scalping trades across BTC, ETH, and XRP pairs. It features a real-time dashboard with market charts, trade logs, KPI cards, and a configuration panel to control the simulation engine. The system mocks Binance market data and includes Telegram bot integration for trade notifications.

This is **not** a real trading bot — it simulates price movements and trades internally for demonstration/monitoring purposes.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React + Vite)

- **Framework:** React 18 with TypeScript, bundled by Vite
- **Routing:** `wouter` (lightweight client-side router) — single page app with a Dashboard as the main route
- **State Management:** `@tanstack/react-query` for server state with polling (1-2 second intervals for real-time data)
- **UI Components:** shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS
- **Charts:** Recharts (AreaChart for market data visualization)
- **Styling:** Tailwind CSS with CSS variables for a dark financial theme, custom color tokens for profit/loss states
- **Path aliases:** `@/` maps to `client/src/`, `@shared/` maps to `shared/`
- **Key pages:** Dashboard (main view with KPIs, chart, trade log, config panel), 404 page
- **Custom hooks:** `use-financial-data.ts` wraps all API calls with React Query

### Backend (Express 5 + Node.js)

- **Framework:** Express 5 running on Node.js with TypeScript (executed via `tsx`)
- **API pattern:** RESTful JSON API under `/api/` prefix
- **Route definitions:** Shared route/schema contracts in `shared/routes.ts` using Zod for validation on both client and server
- **Simulation engine:** `server/simulation.ts` runs a continuous price simulation loop (1-second ticks) for BTC/USDT, ETH/USDT, XRP/USDT with configurable volatility
- **Dev server:** Vite middleware for HMR in development; static file serving in production
- **Build:** Custom build script (`script/build.ts`) using esbuild for server + Vite for client, outputs to `dist/`

### Database (PostgreSQL + Drizzle ORM)

- **ORM:** Drizzle ORM with PostgreSQL dialect
- **Connection:** `node-postgres` (pg) Pool, configured via `DATABASE_URL` environment variable
- **Schema location:** `shared/schema.ts` — shared between client and server
- **Tables:**
  - `trades` — trade records with entry/exit prices, profit, status (OPEN/CLOSED), exit reasons
  - `configurations` — engine settings (symbol, TP percentage, max hold time, cooldown, daily loss limit, running state)
  - `market_candles` — OHLC price data with timestamps
- **Schema push:** `npm run db:push` uses `drizzle-kit push` to sync schema to database
- **Migrations:** Output to `./migrations` directory via drizzle-kit
- **Storage layer:** `server/storage.ts` implements `IStorage` interface with `DatabaseStorage` class wrapping all DB operations

### Shared Code (`shared/`)

- `schema.ts` — Drizzle table definitions, Zod insert schemas, TypeScript types
- `routes.ts` — API contract definitions with Zod schemas for request/response validation
- Both client and server import from this directory to ensure type safety across the stack

### Key Design Decisions

1. **Simulation over real trading:** Price movements are generated with random walks (configurable volatility/drift), not connected to real exchanges. This makes the app self-contained.
2. **Shared schema contracts:** Using `shared/` directory with Drizzle + Zod means the database schema, API contracts, and form validation all derive from a single source of truth.
3. **Polling over WebSockets:** The frontend uses React Query's `refetchInterval` (1-2s) for real-time updates rather than WebSockets, keeping things simple.
4. **Single-page dashboard:** The entire UI is one page — no multi-page navigation needed for a monitoring dashboard.

## External Dependencies

### Required Services

- **PostgreSQL Database:** Required. Connected via `DATABASE_URL` environment variable. The app will crash on startup without it.

### Optional Services

- **Telegram Bot:** Optional integration for trade notifications. Requires:
  - `TELEGRAM_BOT_TOKEN` — Bot API token from BotFather
  - `TELEGRAM_CHAT_ID` — Target chat ID for notifications
  - If not configured, the bot silently skips initialization

### Key npm Packages

- **drizzle-orm / drizzle-kit** — Database ORM and migration tooling
- **express v5** — HTTP server
- **@tanstack/react-query** — Client-side data fetching and caching
- **recharts** — Charting library for market data visualization
- **zod / drizzle-zod** — Schema validation shared between client and server
- **react-hook-form / @hookform/resolvers** — Form handling for configuration panel
- **node-telegram-bot-api** — Telegram bot integration
- **wouter** — Client-side routing
- **date-fns** — Date formatting utilities
- **shadcn/ui ecosystem** — Radix UI primitives, class-variance-authority, tailwind-merge, clsx