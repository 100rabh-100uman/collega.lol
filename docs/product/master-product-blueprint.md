# COLLEGA.LOL — Master Product Blueprint

## 1. Vision & Overview
COLLEGA.LOL is a hyper-local connected campus platform designed to streamline student life, campus commerce, and collaborative peer services. The platform is organized as a **modular monolith** with a unified shared core and four distinct business modules.

---

## 2. Product Modules

### Module 1: Smart Ordering (First MVP)
- **Objective:** Solve campus canteen and food kiosk wait times via remote ordering, menu browsing, and pickup queuing.
- **Priority:** Phase 4 Priority MVP.
- **Shop Scope:** Multiple-shop architecture supported by design; initial launch executed as a focused **one-shop pilot**.
- **Key Rules:**
  - **Manual acceptance by default:** Kiosk staff manually review and accept incoming orders. Optional automatic acceptance can be toggled per vendor.
  - **Timers:** 3-minute alert reminder to vendor dashboard; unanswered manual-acceptance orders expire at 5 minutes from placement.
  - **Canonical Order Statuses:** `PLACED` -> `CONFIRMED` -> `PREPARING` -> `READY` -> `PICKED_UP` -> `COMPLETED`.
    - Exceptional outcomes: `REJECTED`, `CANCELLED`, `EXPIRED`, and `FAILED`.
  - **Payment State Separation:** Payment status (`PENDING`, `AUTHORIZED`, `PAID`, `REFUNDED`, `FAILED`) is decoupled from order status. `REFUNDED` is strictly a payment outcome, never an order status.
  - **Pickup Verification:** Order-number pickup token verified at the counter.
  - **Test Orders First:** Test order workflow must be operational before enabling live payment gateway processing.
  - **Manual Product Availability:** Availability is manually toggled by vendor staff (`isAvailable`). Exact numerical inventory tracking is strictly excluded from MVP.
  - **Price-Change Confirmation:** Explicit student confirmation required if prices change during pending checkout.
  - **Reason Auditing:** Structured cancellation and rejection reasons are mandatory.

### Module 2: Parcel Assistance
- **Objective:** Peer-to-peer campus delivery assistance for incoming postal packages and courier drops across campus gates/hostels.
- **Boundaries:** Integrated with Core Auth and Student Earning, but cleanly isolated in domain logic.

### Module 3: Buy/Sell
- **Objective:** Campus marketplace for student-to-student exchange of textbooks, electronics, cycle/dorm essentials, and stationery.
- **Boundaries:** Peer-to-peer listing, communication, and verified campus transactions.

### Module 4: Student Earning
- **Objective:** Centralized framework allowing students to earn on campus through approved peer tasks (e.g., parcel pickup, peer errands).
- **Scope Restriction:** Unified under **Student Earning**. *No separate "Student Tasks" or "Student Services" modules are permitted.*

---

## 3. Technology Stack

- **Framework:** Next.js (App Router), React 19 / Server Components
- **Language:** TypeScript (strict mode)
- **Styling & UI:** Tailwind CSS, shadcn/ui component library
- **Database:** PostgreSQL (hosted via Supabase or Neon/managed Postgres)
- **ORM:** Prisma
- **Authentication:** Supabase Auth (student identity, campus email verification, session handling)
- **Object Storage:** Supabase Storage (menu photos, product images, verification docs)
- **Deployment & Hosting:** Vercel
- **Version Control & CI/CD:** GitHub

---

## 4. Architectural Principles
1. **Modular Monolith:** All four modules reside in a single codebase with clean folder separation (`modules/smart-ordering`, `modules/parcel-assistance`, `modules/buy-sell`, `modules/student-earning`) and a central `core` package.
2. **Shared Core:** Authentication, campus profiles, base notifications, event bus, and audit logging live in `src/core`.
3. **Module Independence:** Modules must not directly query another module's database tables. Communication between modules occurs strictly via internal service APIs or domain events.
4. **Iterative Delivery:** First release strictly targets Smart Ordering MVP. Future modules are scaffolded for schema and interface compatibility without premature implementation.
