# Security & Data Protection Standards

## 1. Secrets & Credentials Management
- **Zero Secrets in Git:** Never commit `.env`, API keys, database connection strings, or Supabase service role keys.
- **Client vs. Server Env:**
  - Only prefix variables with `NEXT_PUBLIC_` if they are explicitly safe for browser exposure (e.g., Supabase Anon Key, public app URL).
  - All database credentials, payment secret keys, and admin keys must remain strictly server-side.

---

## 2. Authentication & Authorization Guardrails
- **Session Verification:** Validate authenticated session on every Server Action and protected route using the Supabase server client.
- **Strict RBAC Enforcement:** Verify roles (`STUDENT`, `VENDOR_STAFF`, `VENDOR_ADMIN`, `CAMPUS_ADMIN`) server-side before executing mutations.
- **Tenant Isolation:**
  - A vendor user may only inspect, accept, or mutate orders matching their assigned `vendorId`.
  - Always enforce `where: { vendorId: session.vendorId }` in Prisma queries. Never rely solely on client-provided IDs.

---

## 3. Input Validation & Data Integrity
- **Zod Validation:** All mutations, form submissions, and webhook payloads must pass strict Zod schema validation before processing.
- **Idempotency & Race Conditions:** Critical operations (e.g., accepting an order, cancelling, processing payment callback) must be idempotent and handle concurrent status updates safely.
- **File Uploads:** Validate file MIME types, extensions, and enforce maximum file sizes before pushing assets to Supabase Storage.
