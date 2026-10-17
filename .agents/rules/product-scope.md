# Product Scope & Domain Guardrails

## 1. Approved Product Scope
COLLEGA.LOL contains exactly four planned modules:
1. **Smart Ordering (MVP):** Campus food kiosk/canteen mobile ordering with order-number pickup.
2. **Parcel Assistance:** Peer-to-peer campus gate & courier package delivery.
3. **Buy/Sell:** Campus student-to-student marketplace.
4. **Student Earning:** Centralized framework for student tasks, gigs, and earning opportunities.

> [!CAUTION]
> **Strict Module Restriction:** Never create standalone `Student Tasks` or `Student Services` modules. All task/earning mechanics belong exclusively to `Student Earning`.

---

## 2. Smart Ordering MVP Scope Rules
- **Phase 4 Focus:** Implement Smart Ordering first.
- **Multi-Shop Architecture with One-Shop Pilot:** Design schema and services for multiple vendors per campus from day one, but launch initial pilot with a single shop.
- **Test Mode First:** Test orders must be fully operational before integrating live real-money payments.
- **Acceptance Mode:** Orders default to manual vendor acceptance; automatic acceptance is an optional vendor setting.
- **Timer Bounds (From Placement):** 3-minute alert reminder to vendor; unanswered manual-acceptance orders expire at 5 minutes from placement.
- **Canonical Order Statuses:**
  - Standard: `PLACED`, `CONFIRMED`, `PREPARING`, `READY`, `PICKED_UP`, `COMPLETED`.
  - Exceptional: `REJECTED`, `CANCELLED`, `EXPIRED`, `FAILED`.
- **Payment State Decoupling:** `REFUNDED` is strictly a payment outcome, never an order status.
- **Product Availability:** Manually managed by vendor (`isAvailable`). Exact numerical inventory tracking is excluded from the MVP.
- **Integrity Checks:** Mandate explicit price change confirmations and real-time availability checks at checkout.
- **Audit Reasons:** All cancellations and rejections must capture structured reason codes.
- **Pickup Verification:** Identification occurs via short, legible order tokens at the physical counter.
