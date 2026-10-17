# Feature Implementation Workflow

This workflow must be followed when planning, developing, and validating any feature in COLLEGA.LOL.

---

## Step 1: Scope & Boundary Alignment
- Review `docs/product/master-product-blueprint.md` and `.agents/rules/product-scope.md`.
- Confirm the feature belongs to the target module (`smart-ordering`, `parcel-assistance`, `buy-sell`, or `student-earning`) or `core`.
- If implementing an order feature, ensure adherence to locked rules (e.g., manual acceptance, 3/5 min timers, no unit inventory).

## Step 2: Domain Modeling & Schema Changes
- If database models are needed, define them in the Prisma schema with explicit relation constraints and indexes.
- Ensure cross-module foreign keys do not create tight circular dependencies.
- Run schema validation and generate the updated Prisma client.

## Step 3: Domain Service & Business Logic
- Write pure business logic and state machine handlers in `src/modules/<module>/services/`.
- Define input and output contracts using `zod` schemas.
- Implement explicit error types and guards against invalid state transitions.

## Step 4: Server Actions & Authorization
- Implement Server Actions or Route Handlers in `src/modules/<module>/actions/` or `src/app/api/`.
- Validate user session and role (`STUDENT`, `VENDOR_STAFF`, etc.) at the top of the action.
- Enforce tenant boundaries (e.g., matching `vendorId`).

## Step 5: UI Construction (Tailwind + shadcn/ui)
- Build or compose UI using existing shadcn/ui primitives in `src/components/ui/`.
- Keep components responsive, clean, and accessible.
- Maintain clear separation between data-fetching Server Components and interactive Client Components (`'use client'`).

## Step 6: Verification & Quality Gates
- Run TypeScript compiler checks: `npx tsc --noEmit`.
- Run ESLint to verify style and import hygiene: `npm run lint`.
- Manually or automatically verify the feature path and edge cases (e.g., timeout scenarios, rejection reasons).
