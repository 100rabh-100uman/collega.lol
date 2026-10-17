# Architecture & Engineering Standards

## 1. Approved Technology Stack
- **Framework:** Next.js (App Router), React 19
- **Language:** TypeScript with strict type checking enabled
- **UI & Styling:** Tailwind CSS, shadcn/ui (Radix Primitives)
- **Database & ORM:** PostgreSQL managed via Prisma
- **Auth & Storage:** Supabase (Auth for sessions/SSO, Storage for binary assets)
- **Hosting:** Vercel (Production & Preview deployments)

---

## 2. Monolith Structure & Boundaries
- **Modular Monolith:** Code resides in `src/modules/<module-name>` and `src/core`.
- **Core Separation:**
  - Common identity, audit logging, database client singleton, and storage utilities reside in `src/core`.
  - Modules must not directly import internals from other modules. Cross-module calls must go through documented public service APIs (`modules/<module>/services/`).
- **Data Encapsulation:**
  - No direct cross-domain table queries. Smart Ordering code must not directly query future modules' tables.

---

## 3. Server Actions & Component Best Practices
- **Server Components by Default:** Fetch data directly in React Server Components (RSC) to minimize client bundle size and latency.
- **Client Components (`'use client'`):** Reserve for forms, interactive UI state, audio cues, and active WebSocket/polling subscriptions.
- **Validation:** Every mutation and Server Action must validate inputs using `zod` schemas before touching Prisma models.
- **Type Safety:** Never use `any`. Derive types from Prisma models or domain Zod schemas.
