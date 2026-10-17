# Smart Ordering — Architectural Specification

## 1. Domain Overview
The **Smart Ordering** module (`modules/smart-ordering`) is the Phase 4 initial MVP for COLLEGA.LOL. It streamlines ordering, kitchen preparation, and queue-less pickup at campus kiosks, cafeterias, and canteens.

---

## 2. Locked Core Business Rules

### Rule 1: Multiple-Shop Support with One-Shop Pilot
- **Architecture:** The data model and services natively support multiple shops/vendors per campus from day one (each vendor has independent operating hours, menus, staff, and order queues).
- **Rollout:** The initial production release operates as a single-shop pilot to validate real kitchen operations before onboarding additional vendors.

### Rule 2: Test Orders Before Real Payments
- Prior to connecting live payment gateways (e.g., Razorpay/Stripe), the system mandates a fully functional test/sandbox order workflow.
- Test orders simulate the complete lifecycle (`PLACED` through `COMPLETED`) without processing real currency.
- Payment gateway adapters implement a unified interface with a mock/test adapter enabled by default.

### Rule 3: Manual Acceptance by Default (Optional Auto-Accept)
- In campus dining, kitchen loads and ingredient conditions fluctuate rapidly.
- Orders default to **manual acceptance** by kiosk staff.
- An optional **automatic acceptance** mode can be enabled in vendor settings by authorized vendor managers, but manual acceptance remains the default configuration.

### Rule 4: 3-Minute Reminder & 5-Minute Auto-Expiry
- Both timers are calculated strictly from the time of order placement (`PLACED`):
  - **T + 3:00:** If a manual-acceptance order remains unanswered in `PLACED`, an urgent visual and audio reminder is triggered on the vendor dashboard.
  - **T + 5:00:** If still unacknowledged after 5 minutes from placement, the order automatically transitions to `EXPIRED`.
- On expiry:
  - The student is immediately notified.
  - Any associated payment authorization is released or queued for refund.
  - Prevents students from being stranded waiting indefinitely.

### Rule 5: Manual Product Availability (No Exact Inventory Tracking)
- Product availability is manually managed by vendor staff via simple toggles (`isAvailable: boolean`).
- **Exact inventory tracking is excluded from the MVP.** Campus vendors do not count unit quantities (e.g., slices of bread or drink cans) in real time.
- At checkout, the server re-validates item availability; if any item was toggled off, checkout is blocked with an explicit error.

### Rule 6: Explicit Price-Change Confirmation
- If a vendor modifies the price of a menu item while a student has it in their active cart or pending checkout session, checkout is halted.
- The student must be presented with the price differential and explicitly confirm acceptance before the order can be placed.

### Rule 7: Mandatory Structured Cancellation & Rejection Reasons
- Neither vendors nor students can cancel or reject an order without providing a structured reason code:
  - Vendor rejection reasons: `OUT_OF_STOCK`, `KITCHEN_OVERLOADED`, `STORE_CLOSING_EARLY`, `ITEM_PRICE_MISMATCH`, `OTHER`.
  - Student cancellation reasons: `WAIT_TIME_TOO_LONG`, `ORDERED_BY_MISTAKE`, `VENDOR_UNRESPONSIVE`, `OTHER`.
- Rejection and cancellation reasons are permanently stored in the audit log for dispute resolution and operational metrics.

### Rule 8: Order-Number Counter Pickup Verification
- Upon order confirmation, a compact, human-readable pickup token (e.g., `#A-14`, `#B-02`) is assigned.
- Food handover at the physical counter is verified strictly using this token and the student's active order screen.

---

## 3. Order Lifecycle State Machine

Order statuses track the fulfillment lifecycle of the order.

### Canonical Order Statuses
1. `PLACED`: Order created by student; awaiting vendor acceptance (or auto-accept evaluation).
2. `CONFIRMED`: Vendor has accepted the order (or auto-accepted); kitchen has queued the order.
3. `PREPARING`: Kitchen has actively started preparing the items.
4. `READY`: Order is packaged and waiting at the counter for pickup.
5. `PICKED_UP`: Counter staff has verified the student's pickup token and handed over the food.
6. `COMPLETED`: Order lifecycle is successfully finished and closed.

### Canonical Exceptional Outcomes
- `REJECTED`: Vendor declined the order (requires structured vendor rejection reason).
- `CANCELLED`: Student cancelled the order before preparation began (requires structured student cancellation reason).
- `EXPIRED`: Unanswered manual-acceptance order timed out 5 minutes after placement.
- `FAILED`: System, validation, or processing failure.

```
                    ┌─ (Auto-Accept / Vendor Accepts) ─> CONFIRMED ─> PREPARING ─> READY ─> PICKED_UP ─> COMPLETED
                    │
[PLACED] ───────────┼─ (Vendor Rejects with Reason) ──> REJECTED
                    │
                    ├─ (Student Cancels with Reason) ─> CANCELLED
                    │
                    ├─ (Unanswered after 5 minutes) ──> EXPIRED
                    │
                    └─ (System / Validation Fault) ───> FAILED
```

---

## 4. Separation of Order States and Payment States

> [!IMPORTANT]
> **Strict Domain Separation:** Payment states are decoupled from order statuses.
> `REFUNDED` is strictly a **payment outcome**, never an order status.

### Canonical Payment Statuses
- `PENDING`: Payment initiation in progress.
- `AUTHORIZED`: Funds held/pre-authorized (if gateway supports two-step capture).
- `PAID`: Payment successfully captured.
- `REFUNDED`: Funds returned to student (e.g., following `REJECTED`, `CANCELLED`, or `EXPIRED` order states).
- `FAILED`: Payment processing error or decline by payment provider.

An order in state `EXPIRED` or `CANCELLED` has its associated payment record transition to `REFUNDED`.

---

## 5. Module Boundaries & Data Ownership

- **Smart Ordering owns:**
  - `Vendor` (id, campusId, name, location, operatingHours, isOpen, autoAcceptEnabled)
  - `MenuCategory` & `MenuItem` (id, vendorId, name, price, isAvailable, preparationTimeEst)
  - `Order` (id, orderNumber, vendorId, studentId, status, paymentStatus, cancellationReason, rejectionReason, timestamps)
  - `OrderItem` (id, orderId, menuItemId, quantity, unitPriceAtOrder)
  - `OrderStatusHistory` (id, orderId, fromStatus, toStatus, changedBy, reason, timestamp)
- **Smart Ordering consumes from Core:**
  - `User` / `StudentProfile` (`userId`, `campusEmail`, `phone`, `campusId`)
  - `NotificationService` (vendor audio/visual alerts, student status notifications)
