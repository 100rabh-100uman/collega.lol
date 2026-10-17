# Release & Deployment Workflow

This workflow governs shipping changes safely to GitHub and Vercel.

---

## Step 1: Pre-Release Quality Gates
Execute local pre-flight checks before preparing a release:
1. **Type Check:** `npx tsc --noEmit` must pass with zero errors.
2. **Lint Check:** `npm run lint` must pass cleanly.
3. **Build Check:** `npm run build` must complete successfully without build-time warnings or missing environment variable crashes.
4. **Order Flow Smoke Test:** Verify that the test-order workflow completes end-to-end without regression.

## Step 2: Database Migration Check
- Verify that any Prisma schema changes have corresponding migration files generated (`npx prisma migrate dev` or `npx prisma migrate deploy`).
- Confirm migrations are additive and non-destructive to live production data.

## Step 3: Environment Variable Audit
Ensure Vercel project environment settings contain all required keys:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` (direct connection string for migrations)
- `DIRECT_URL` (if connection pooling is active)
- `NEXT_PUBLIC_APP_URL`

## Step 4: Version Control & Commit Standards
- Commit using conventional commit format:
  - `feat(ordering): implement 3-minute reminder audio notification`
  - `fix(core): resolve session refresh on mobile web`
  - `docs(arch): update database schema diagram`
- Push branch to GitHub and create a Pull Request.

## Step 5: Vercel Preview Verification
- Review the automated Vercel Preview deployment generated from the pull request.
- Test primary responsive layouts on mobile viewport (campus students use phones primarily).
- Merge to `main` upon approval to trigger automatic production deployment.
