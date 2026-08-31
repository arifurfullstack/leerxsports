# ⚡ LEER Sports

> A sports social and creator monetization platform powered by **TanStack Start (SSR)**, **React 19**, **Vite**, **Tailwind CSS v4**, and **Supabase**.

---

## 🌟 Overview

**LEER Sports** connects athletes, coaches, and sports enthusiasts in a high-performance interactive space. Trainers can publish workouts, reels, and exclusive premium drills, answer community Q&As, and provide 1-on-1 private coaching. Trainees can discover trending fitness content, ask questions, share transformation progress, and subscribe to verified coaches.

---

## 🚀 Key Modules & Features

- **🔐 Auth & Role Management**: Multi-role support (`Trainee`, `Trainer`, `Admin`) with verified badges and onboarding guards.
- **🎬 Discovery Feed & Shorts**: Compact 3-column feed and vertical fullscreen reels player with autoplay, sound control, and engagement reactions.
- **🔒 Paywall & Media Protection**: 12px blur teaser thumbnails with lock indicators for non-subscribers and secured media stripping.
- **💳 Multi-Gateway Checkout**: Hosted Stripe Checkout redirect and PayPal Sandbox with monthly auto-recurring subscriptions ($4.99 – $499.99).
- **🏋️ Paid Private Coaching**: 1-on-1 coaching threads with structured 4-stage lifecycle (`PENDING` → `COACHED` → `1 FOLLOW-UP` → `COMPLETED`).
- **💬 Community Q&A & FLEX**: Forum-style single-column Q&A with official verified coach answers and transformation comparison slider.
- **🛡️ Admin Command Center**: Full dashboard (`/admin`) for reviewing pending trainer applications, content moderation, user management, and payment gateway configuration.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | [React 19](https://react.dev/), [TanStack Start (SSR)](https://tanstack.com/start), [TanStack Router](https://tanstack.com/router) |
| **Data & State** | [TanStack Query v5](https://tanstack.com/query), TanStack Start Server Functions |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/), Radix UI Primitives, [Lucide Icons](https://lucide.dev/) |
| **Backend & DB** | [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, Auth, Storage) |
| **Testing** | [Playwright](https://playwright.dev/) (E2E), [Vitest](https://vitest.dev/) (Unit/Integration) |

---

## 🏁 Quick Start

### 1. Prerequisites
- **Node.js**: v20+ (Node 22 or 24 recommended)
- **npm**: v10+

### 2. Environment Configuration
Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3333](http://localhost:3333) in your browser.

---

## 🧪 Testing & Quality Assurance

### Run Unit & Integration Tests (Vitest)
```bash
npm test
```

### Run End-to-End Test Suite (Playwright)
```bash
npx playwright test
```

### Typecheck & Production Build
```bash
npx tsc --noEmit
npm run build
```

---

## 🔑 QA & Verification Credentials

| Role | Email | Password | Access URL |
| :--- | :--- | :--- | :--- |
| **Admin** | `qa.admin@leersports.com` | `LeerAdmin2026!` | `/admin` |
| **Verified Trainer** | `qa.verified.trainer@leersports.com` | `LeerSports2026!Verified` | `/creator/dashboard` |
| **Pending Trainer** | `qa.pending.trainer@leersports.com` | `LeerSports2026!Pending` | `/community` |
| **Trainee / Fan** | `qa.trainee@leersports.com` | `LeerSports2026!Trainee` | `/home` |
| **Subscriber** | `qa.subscriber@leersports.com` | `LeerSports2026!Subscriber` | `/library` |

---

## 📄 License

Private & Proprietary — LEER Platform. All rights reserved.
