# PGX Sports Lounge (leersxsport)

A next-generation sports, fitness, and community platform built using **TanStack Start**, **React 19**, **TypeScript**, and **Supabase**. It provides dynamic matching, interactive feeds, training program discoveries, class scheduling, and real-time community engagement.

---

## 🚀 Key Features

*   **🏋️‍♂️ Trainer & Sports Profiles**: Fully interactive profiles detailing services, user reviews, media libraries, post feeds, and class bookings.
*   **📱 Rich Community Feed**: Interactive post feed support with attachments, comments, likes, tags, and real-time updates.
*   **🎥 Shorts Feed**: Native vertical short-video feed for dynamic engagement and sharing fitness clips.
*   **📅 Class Booking & Exploration**: Discover, filter, and schedule fitness classes and activities locally.
*   **💬 Real-Time Chats**: Real-time communication and notifications built on top of Supabase Postgres changes.
*   **🔐 Secure Authentication**: Integrated login, register, password reset, and email verification workflows.

---

## 🛠️ Technology Stack

*   **Frontend Library**: [React 19](https://react.dev/)
*   **Framework & Router**: [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) & [TanStack Router](https://tanstack.com/router/v1)
*   **Programming Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
*   **Database & Backend Services**: [Supabase](https://supabase.com/) (PostgreSQL Database, Realtime, Storage, Auth)
*   **State Management / Fetching**: [TanStack Query (React Query)](https://tanstack.com/query/v3)
*   **Bundler & Dev Server**: [Vite](https://vitejs.dev/)

---

## 📦 Project Structure

```text
├── public/                 # Static assets
├── supabase/               # Local Supabase configurations & SQL migrations
├── src/
│   ├── components/         # Reusable UI component library (Shadcn-based)
│   ├── hooks/              # Custom React hooks (Auth, Supabase, data query)
│   ├── integrations/       # API integrations & third-party hooks
│   ├── lib/                # Library utilities & client initializers
│   ├── routes/             # File-based routing folder (TanStack Router)
│   ├── styles.css          # Main stylesheet featuring Tailwind imports
│   ├── router.tsx          # Router config & TanStack root setup
│   ├── server.ts           # Nitro server adapter entry point
│   └── start.ts            # Hydration start entry point
├── package.json            # Scripts & project dependencies
└── tsconfig.json           # TypeScript configuration
```

---

## ⚙️ Setup and Installation

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v18+ recommended) and a package manager installed (npm, pnpm, or bun).

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/arifurfullstack/next-gen-web.git
cd leersxsport
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your Supabase project keys:
```bash
cp .env.example .env
```

Open `.env` and enter your specific project variables:
```env
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
```

### 3. Start Development Server
To launch the project in local development mode:
```bash
npm run dev
```
The server will start (usually on [http://localhost:8080](http://localhost:8080) or [http://localhost:8081](http://localhost:8081) if occupied).

---

## 🛠️ Available Scripts

In the project directory, you can run:

*   `npm run dev`: Runs the app in development mode with hot-reloading.
*   `npm run build`: Builds the app for production (Nitro output).
*   `npm run preview`: Locally previews the production build.
*   `npm run lint`: Analyzes code for potential style and syntax issues.
*   `npm run format`: Formats code files using Prettier.
*   `npm run test`: Runs unit tests with Vitest.
