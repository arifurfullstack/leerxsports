# ⚡ LEER — Next-Gen Sports & Creator Monetization Platform

> A high-performance, real-time sports community and creator monetization platform powered by **TanStack Start (SSR)**, **React 19**, **Vite**, **Tailwind CSS v4**, and **Supabase**.

---

## 🌟 Overview

**LEER** connects sports enthusiasts, athletes, and fitness creators in an immersive, interactive environment. Creators can monetize their content through paid subscriptions, coaching tips, and premium post unlocks, while users enjoy seamless content discovery, live streaming, real-time social engagement, and a unified digital wallet.

---

## 🔥 Key Features

### 🏋️ Creator Monetization & Paid Experience
* **Verified Creator Subscriptions**: Monthly recurring subscriber access to exclusive feeds, transformation posts, and direct feedback.
* **Direct Fan Tips**: Send custom or preset tips to creators with optional personalized messages.
* **Premium Content Unlocks**: Pay-per-view access to exclusive media, video guides, and premium training insights.
* **Atomic Creator Earnings**: Automatic 80/20 platform revenue splits with instant credit to creator wallet balances upon payment confirmation.

### 💳 Unified LEER Wallet & Multi-Gateway Payments
* **LEER Digital Wallet**: Instant wallet top-ups via Stripe, PayPal, or Bank Transfer, enabling zero-latency purchases across the platform.
* **Integrated Payment Checkout**: Built-in support for Stripe Checkout, PayPal Capture, Bank Transfers, and Wallet balance debits.
* **Complete Audit Trail**: Real-time transaction history and `wallet_entries` ledger tracking every top-up, tip, subscription, and earnings credit.

### 🔔 Modern Notifications & Real-Time Interaction
* **Multi-Tab Notifications Hub**: Filter by *All*, *Unread*, *Social*, and *System* notifications.
* **Interactive Actions**: Quick "Follow Back", "Reply", and "View Tip" actions directly from notification popovers or the dedicated notifications hub.
* **Live Streaming Integration**: Broadcast live sessions powered by Agora RTC with numeric UID mapping and interactive viewer lobbies.

### 🛡️ Admin Dashboard & Governance
* **Commerce & Payouts**: Real-time analytics, transaction logs, trainer payout processing, and refund management.
* **Gateway Management**: Admin configuration interface for enabling test/live modes for Stripe, PayPal, and Bank payment gateways.
* **User & Moderation Management**: Role-based access control (`admin`, `trainer`, `user`), strike issuance, content moderation, and report resolution.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | [React 19](https://react.dev/), [TanStack Start (SSR)](https://tanstack.com/start), [TanStack Router](https://tanstack.com/router) |
| **Build & Tooling** | [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/) |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com/), Radix UI Primitives, [Lucide Icons](https://lucide.dev/) |
| **Data Fetching & State** | [TanStack Query v5](https://tanstack.com/query), TanStack Start Server Functions |
| **Backend & Database** | [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, Auth, Storage) |
| **Live Streaming** | Agora RTC Engine |
| **Testing** | [Vitest](https://vitest.dev/) unit & integration tests |

---

## 📁 Repository Structure

```
Leersports-main/
├── src/
│   ├── components/            # Reusable UI components & dialogs
│   │   ├── notifications/     # Notifications popover, hub & item components
│   │   ├── paid-checkout-button.tsx  # Unified payment checkout button
│   │   ├── tip-modal.tsx      # Coaching & creator tip modal
│   │   └── navbar.tsx         # Responsive header & wallet balance widget
│   ├── integrations/
│   │   └── supabase/          # Supabase client, server admin & types
│   ├── lib/                   # Server functions & core business logic
│   │   ├── checkout-functions.ts     # Order creation & checkout gateway logic
│   │   ├── payment-checkout.server.ts # Stripe/PayPal/Bank verification
│   │   ├── wallet-functions.ts       # Wallet balance & crediting helpers
│   │   └── webhook-processors.server.ts # Payment gateway webhooks
│   └── routes/                # TanStack file-based routing
│       ├── _authenticated/    # Protected user, wallet & admin routes
│       ├── creators.tsx       # Creator discovery directory
│       └── feed.tsx           # Primary content feed
├── supabase/
│   └── migrations/            # Version-controlled PostgreSQL migrations
├── scripts/                   # Automated regression & database verification scripts
├── public/                    # Static assets & icons
├── package.json
└── vite.config.ts
```

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js**: v20.x or higher (Node 24 recommended)
* **npm**: v10.x or higher
* **Supabase Project**: Active Supabase URL & Service Role Key

### 1. Environment Setup
Create a `.env` file in the root directory:

```env
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"

VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:8082](http://localhost:8082) in your browser.

---

## 🧪 Running Tests & Diagnostics

To run the automated Vitest test suite:
```bash
npm test
```

To run demo relation integrity checks:
```bash
npm run test:demo-integrity
```

---

## 📄 License

Private & Proprietary — LEER Platform. All rights reserved.
