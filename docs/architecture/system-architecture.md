# COLLEGA.LOL — System Architecture

## 1. Architectural Pattern: Modular Monolith

COLLEGA.LOL is built as a **Modular Monolith** deployed to Vercel with a single unified PostgreSQL database managed by Prisma. 

```
src/
├── app/                      # Next.js App Router (Layouts, Pages, Route Handlers)
│   ├── (auth)/               # Auth flows (Supabase Auth integration)
│   ├── (core)/               # Common student dashboard, profile, settings
│   ├── (ordering)/           # Smart Ordering student and vendor views
│   └── api/                  # Public webhooks & API endpoints
├── core/                     # Shared Foundation
│   ├── auth/                 # Session extraction, RBAC, campus verification
│   ├── db/                   # Prisma client singleton, base repository helpers
│   ├── storage/              # Supabase Storage client wrapper
│   ├── notifications/        # In-app alerts, push, and transactional notifications
│   ├── types/                # Global domain primitives
│   └── errors/               # Standard domain error classes & handlers
├── modules/                  # Isolated Feature Domains
│   ├── smart-ordering/       # Module 1 (First MVP)
│   ├── parcel-assistance/    # Module 2 (Future phase)
│   ├── buy-sell/             # Module 3 (Future phase)
│   └── student-earning/      # Module 4 (Future phase; encapsulates student tasks/services)
└── components/
    ├── ui/                   # Reusable shadcn/ui components (Radix primitives)
    └── shared/               # Universal design system components
```

---

## 2. Core Boundary Rules

1. **Shared Core Ownership:**
   - User identities, student profiles, campus organizations, and system audit logs belong strictly to `core`.
   - Business modules reference `userId` and `campusId` as external foreign keys without tight runtime coupling.

2. **Cross-Module Communication:**
   - Direct cross-table queries between modules are **prohibited**.
   - If `parcel-assistance` or `smart-ordering` triggers earning, it must invoke `student-earning` via an exported domain service or published event.

3. **No Standalone Tasks or Services Modules:**
   - Any errand, task, or gig logic is scoped strictly under `modules/student-earning`.

---

## 3. Data Architecture (PostgreSQL & Prisma)

- **Database Engine:** PostgreSQL.
- **ORM:** Prisma Client with strict schema models and relations.
- **Schema Separation:**
  - Prefix or group domain models logically (e.g., `Order`, `OrderItem`, `Vendor`, `MenuItem` belong to Smart Ordering).
  - Common tables: `User`, `Campus`, `Profile`, `AuditLog`.
- **Soft Deletes & State Machines:**
  - Critical transactional models (Orders, Transactions) enforce explicit state transitions and maintain audit timestamps (`createdAt`, `updatedAt`).

---

## 4. Auth & Security (Supabase)

- **Authentication:** Supabase Auth handles email magic-links / password / campus SSO.
- **Session Bridge:** Next.js Server Components and Server Actions decode Supabase JWTs via `@supabase/ssr`.
- **Authorization:** Server-side Role-Based Access Control (RBAC): `STUDENT`, `VENDOR_STAFF`, `VENDOR_ADMIN`, `CAMPUS_ADMIN`.
- **Row-Level Security (RLS) & Prisma Guarding:**
  - Database queries via Prisma enforce user tenancy in application logic (`where: { vendorId: session.vendorId }`).
  - Supabase Storage policies guard private receipts and vendor documents.

---

## 5. UI/UX Architecture

- **Styling:** Tailwind CSS with standardized design tokens.
- **Component Primitives:** shadcn/ui (accessible, headless Radix primitives styled with Tailwind).
- **Client vs. Server Components:**
  - Default to React Server Components (RSC) for data fetching and static page generation.
  - Isolate interactive controls, forms, and real-time order polling/subscriptions into focused Client Components (`'use client'`).
