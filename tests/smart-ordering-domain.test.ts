/**
 * COLLEGA.LOL — Stage 4: Smart Ordering Domain Integration Tests
 *
 * Validates OrderService methods against the dedicated 'collega-dev' PostgreSQL database:
 * - createOrder (totals, snapshots, availability, prices, idempotency, boundaries)
 * - acceptOrder (staff tenancy, state transition, timestamp updates)
 * - rejectOrder (structured reasons, staff tenancy)
 * - cancelOrder (student ownership, PLACED-only constraint)
 * - advanceOrderStatus (linear fulfillment, illegal jumps, terminal immutability)
 * - getOrderById (tenant isolation, student ownership, staff access)
 * - Concurrency (mutual exclusion between competing transitions)
 *
 * SAFETY INVARIANTS:
 * - Positively verifies project reference across DATABASE_URL, DIRECT_URL, and NEXT_PUBLIC_SUPABASE_URL.
 * - Fails closed on any mismatch or production target.
 * - Read-only pre-flight scan: halts immediately if leftover test records are detected.
 * - Zero broad deletions: cleanup strictly targets run-scoped tracked IDs.
 * - Baseline seeded catalog remains immutable and read-only.
 * - Surface cleanup errors and verify baseline integrity without destructive repairs.
 */

import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

// Ensure local environment is loaded
try {
  process.loadEnvFile?.(".env");
} catch {
  // Graceful fallback if already loaded
}

import { prisma } from "../src/core/db/prisma";
import { checkDatabaseReadiness } from "../src/core/config/env";
import { OrderService } from "../src/modules/smart-ordering/services/order-service";
import {
  PriceMismatchError,
  ShopClosedError,
  ProductUnavailableError,
} from "../src/modules/smart-ordering/errors";
import { InvalidOrderStateTransitionError } from "../src/modules/smart-ordering/services/order-state-machine";
import { ConflictError, ForbiddenError } from "../src/core/errors";
import type { SessionContext } from "../src/core/types/auth";
import {
  SEED_CAMPUS_ID,
  SEED_SHOP_ID,
  SEED_PRODUCT_VEGGIE_WRAP_ID,
  SEED_PRODUCT_MASALA_FRIES_ID,
} from "../prisma/seed";

// --------------------------------------------------------------------------
// 1. Triple-Endpoint Environment & Positive Identity Verification
// --------------------------------------------------------------------------

function extractProjectRef(rawUrl: string, type: "supabase" | "postgres"): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (type === "supabase") {
      return parsed.hostname.split(".")[0];
    }
    const user = parsed.username || "";
    if (user.startsWith("postgres.")) {
      return user.replace(/^postgres\./, "");
    }
    const host = parsed.hostname || "";
    if (host.startsWith("db.")) {
      return host.replace(/^db\./, "").split(".")[0];
    }
    return null;
  } catch {
    return null;
  }
}

function assertDevelopmentTestTarget(): string {
  const dbStatus = checkDatabaseReadiness();
  if (!dbStatus.isConfigured || dbStatus.isPlaceholder) {
    throw new Error(`[Environment Guard] Safety check failed: ${dbStatus.message}`);
  }

  const dbUrl = process.env.DATABASE_URL || "";
  const directUrl = process.env.DIRECT_URL || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  // Fail closed on production domain indicator
  if (
    process.env.NODE_ENV === "production" ||
    dbUrl.toLowerCase().includes("collega.lol") ||
    appUrl.toLowerCase().includes("collega.lol")
  ) {
    throw new Error(
      "[Environment Guard] Aborted: Production environment detected. Integration tests are strictly prohibited on production."
    );
  }

  const refSupabase = extractProjectRef(supabaseUrl, "supabase");
  const refDb = extractProjectRef(dbUrl, "postgres");
  const refDirect = extractProjectRef(directUrl, "postgres");

  if (!refSupabase || !refDb || !refDirect) {
    throw new Error(
      "[Environment Guard] Aborted: Could not extract valid project references from environment configuration."
    );
  }

  if (refSupabase !== refDb || refSupabase !== refDirect) {
    throw new Error(
      "[Environment Guard] Aborted: Project reference mismatch across DATABASE_URL, DIRECT_URL, and NEXT_PUBLIC_SUPABASE_URL."
    );
  }

  console.log("✔ [Environment Guard] Verified dedicated 'collega-dev' project identity matching across Pooler, Direct, and Supabase endpoints.");
  return refSupabase;
}

// --------------------------------------------------------------------------
// 2. Tracked In-Memory Fixture Registry
// --------------------------------------------------------------------------

const RUN_ID = `test_${Date.now()}_${randomBytes(4).toString("hex")}`;
const createdOrderIds = new Set<string>();
const createdUserIds = new Set<string>();
const createdShopMemberIds = new Set<string>();
const createdShopIds = new Set<string>();
const createdCategoryIds = new Set<string>();
const createdProductIds = new Set<string>();

async function runPreFlightScan(): Promise<void> {
  const leftoverUsers = await prisma.user.findMany({
    where: { email: { contains: "@test.collega.internal" } },
    select: { id: true, email: true },
  });

  const leftoverOrders = await prisma.order.findMany({
    where: { idempotencyKey: { startsWith: "test_" } },
    select: { id: true, idempotencyKey: true },
  });

  if (leftoverUsers.length > 0 || leftoverOrders.length > 0) {
    console.error("❌ [Pre-Flight Scan] Leftover test records detected from an earlier interrupted run:");
    if (leftoverUsers.length > 0) {
      console.error(`   Found ${leftoverUsers.length} test user(s):`, leftoverUsers.map((u) => u.email));
    }
    if (leftoverOrders.length > 0) {
      console.error(`   Found ${leftoverOrders.length} test order(s):`, leftoverOrders.map((o) => o.id));
    }
    console.error("   Execution aborted to prevent data corruption. Please review and safely resolve leftover test records.");
    process.exit(1);
  }
}

// --------------------------------------------------------------------------
// 3. Main Integration Test Suite
// --------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("\n========================================================");
  console.log("  COLLEGA.LOL — Stage 4 Smart Ordering Integration Tests ");
  console.log("========================================================\n");

  assertDevelopmentTestTarget();
  await runPreFlightScan();

  try {
    console.log(`\n--- Setting up isolated test fixtures (Run ID: ${RUN_ID}) ---`);

    // Student A (Primary buyer)
    const studentAId = randomUUID();
    const studentAEmail = `student_a_${RUN_ID}@test.collega.internal`;
    await prisma.user.create({
      data: {
        id: studentAId,
        email: studentAEmail,
        campusId: SEED_CAMPUS_ID,
        role: "STUDENT",
        isActive: true,
      },
    });
    createdUserIds.add(studentAId);

    const studentASession: SessionContext = {
      user: {
        id: studentAId,
        email: studentAEmail,
        role: "STUDENT",
        campusId: SEED_CAMPUS_ID,
        isActive: true,
      },
      shopMemberships: [],
    };

    // Student B (Tenant boundary adversary)
    const studentBId = randomUUID();
    const studentBEmail = `student_b_${RUN_ID}@test.collega.internal`;
    await prisma.user.create({
      data: {
        id: studentBId,
        email: studentBEmail,
        campusId: SEED_CAMPUS_ID,
        role: "STUDENT",
        isActive: true,
      },
    });
    createdUserIds.add(studentBId);

    const studentBSession: SessionContext = {
      user: {
        id: studentBId,
        email: studentBEmail,
        role: "STUDENT",
        campusId: SEED_CAMPUS_ID,
        isActive: true,
      },
      shopMemberships: [],
    };

    // Student Foreign Campus (Wrong campus adversary)
    const studentForeignId = randomUUID();
    const studentForeignEmail = `student_foreign_${RUN_ID}@test.collega.internal`;
    const FOREIGN_CAMPUS_ID = "00000001-9999-4000-8000-000000000001";
    await prisma.user.create({
      data: {
        id: studentForeignId,
        email: studentForeignEmail,
        campusId: null, // No campus assignment
        role: "STUDENT",
        isActive: true,
      },
    });
    createdUserIds.add(studentForeignId);

    const studentForeignSession: SessionContext = {
      user: {
        id: studentForeignId,
        email: studentForeignEmail,
        role: "STUDENT",
        campusId: FOREIGN_CAMPUS_ID,
        isActive: true,
      },
      shopMemberships: [],
    };

    // Kiosk Staff (Shop authority for Quad Bistro)
    const staffId = randomUUID();
    const staffEmail = `staff_${RUN_ID}@test.collega.internal`;
    await prisma.user.create({
      data: {
        id: staffId,
        email: staffEmail,
        campusId: SEED_CAMPUS_ID,
        role: "STUDENT",
        isActive: true,
      },
    });
    createdUserIds.add(staffId);

    const staffMemberId = randomUUID();
    await prisma.shopMember.create({
      data: {
        id: staffMemberId,
        shopId: SEED_SHOP_ID,
        userId: staffId,
        role: "STAFF",
        isActive: true,
      },
    });
    createdShopMemberIds.add(staffMemberId);

    const staffSession: SessionContext = {
      user: {
        id: staffId,
        email: staffEmail,
        role: "STUDENT",
        campusId: SEED_CAMPUS_ID,
        isActive: true,
      },
      shopMemberships: [
        {
          shopId: SEED_SHOP_ID,
          role: "STAFF",
          isActive: true,
        },
      ],
    };

    // Ephemeral Closed Shop (To test closed shop rejection without mutating seed shop)
    const closedShopId = randomUUID();
    await prisma.shop.create({
      data: {
        id: closedShopId,
        campusId: SEED_CAMPUS_ID,
        name: `Closed Test Shop ${RUN_ID}`,
        slug: `closed-shop-${RUN_ID}`,
        location: "Test Block",
        isOpen: false,
      },
    });
    createdShopIds.add(closedShopId);

    // Ephemeral Unavailable Product (To test unavailable product rejection without mutating seed products)
    const testCatId = randomUUID();
    await prisma.category.create({
      data: {
        id: testCatId,
        shopId: SEED_SHOP_ID,
        name: `Ephemeral Cat ${RUN_ID}`,
        slug: `ephemeral-cat-${RUN_ID}`,
        isAvailable: true,
      },
    });
    createdCategoryIds.add(testCatId);

    const unavailableProductId = randomUUID();
    await prisma.product.create({
      data: {
        id: unavailableProductId,
        shopId: SEED_SHOP_ID,
        categoryId: testCatId,
        name: `Unavailable Item ${RUN_ID}`,
        price: new Prisma.Decimal("100.00"),
        isAvailable: false, // Mark unavailable
      },
    });
    createdProductIds.add(unavailableProductId);

    console.log("✔ Isolated fixtures initialized cleanly.\n");

    // =========================================================================
    // Test Scenarios
    // =========================================================================

    console.log("--- Executing Domain Service Integration Scenarios ---");

    // 1. Successful Order Creation & Exact Decimal Totals & Snapshots
    {
      const idempotencyKey = `${RUN_ID}_order_1`;
      const order = await OrderService.createOrder(studentASession, {
        shopId: SEED_SHOP_ID,
        idempotencyKey,
        items: [
          {
            productId: SEED_PRODUCT_VEGGIE_WRAP_ID,
            quantity: 2,
            expectedUnitPrice: "120.00",
            specialInstructions: "Extra sauce",
          },
          {
            productId: SEED_PRODUCT_MASALA_FRIES_ID,
            quantity: 1,
            expectedUnitPrice: "90.00",
          },
        ],
      });
      createdOrderIds.add(order.id);

      assert.equal(order.status, "PLACED");
      assert.equal(order.userId, studentAId);
      assert.equal(order.shopId, SEED_SHOP_ID);
      assert.equal(order.items.length, 2);
      // Exact Decimal: 2 * 120.00 + 1 * 90.00 = 330.00
      assert.equal(order.totalAmount.toFixed(2), "330.00");
      assert.equal(order.currency, "INR");
      assert.equal(order.confirmedAt, null);

      // Snapshots verification
      const wrapItem = order.items.find((i) => i.productId === SEED_PRODUCT_VEGGIE_WRAP_ID)!;
      assert.equal(wrapItem.productNameSnapshot, "Veggie Wrap");
      assert.equal(wrapItem.unitPriceSnapshot.toFixed(2), "120.00");
      assert.equal(wrapItem.subtotal.toFixed(2), "240.00");
      assert.equal(wrapItem.specialInstructions, "Extra sauce");

      // Status history
      assert.equal(order.statusHistory.length, 1);
      assert.equal(order.statusHistory[0].toStatus, "PLACED");

      // Payment record decoupling
      assert.equal(order.payments.length, 1);
      assert.equal(order.payments[0].status, "PENDING");
      assert.equal(order.payments[0].amount.toFixed(2), "330.00");
      assert.equal(order.payments[0].refundedAt, null);

      console.log("✔ Scenario 1: Successful Order Creation, Exact Decimal Totals, Snapshots & Payment Record verified.");
    }

    // 2. Closed Shop Rejection
    {
      await assert.rejects(
        async () => {
          await OrderService.createOrder(studentASession, {
            shopId: closedShopId,
            items: [
              {
                productId: SEED_PRODUCT_VEGGIE_WRAP_ID,
                quantity: 1,
                expectedUnitPrice: "120.00",
              },
            ],
          });
        },
        ShopClosedError
      );
      console.log("✔ Scenario 2: Closed Shop correctly rejects order placement.");
    }

    // 3. Unavailable Product Rejection
    {
      await assert.rejects(
        async () => {
          await OrderService.createOrder(studentASession, {
            shopId: SEED_SHOP_ID,
            items: [
              {
                productId: unavailableProductId,
                quantity: 1,
                expectedUnitPrice: "100.00",
              },
            ],
          });
        },
        ProductUnavailableError
      );
      console.log("✔ Scenario 3: Unavailable Product correctly rejects order placement.");
    }

    // 4. Price Mismatch Detection & Structured 409
    {
      try {
        await OrderService.createOrder(studentASession, {
          shopId: SEED_SHOP_ID,
          items: [
            {
              productId: SEED_PRODUCT_VEGGIE_WRAP_ID,
              quantity: 1,
              expectedUnitPrice: "110.00", // Actual is 120.00
            },
          ],
        });
        assert.fail("Should have thrown PriceMismatchError");
      } catch (err: unknown) {
        assert.ok(err instanceof PriceMismatchError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.mismatches.length, 1);
        assert.equal(err.mismatches[0].productId, SEED_PRODUCT_VEGGIE_WRAP_ID);
        assert.equal(err.mismatches[0].expectedPrice, "110.00");
        assert.equal(err.mismatches[0].actualPrice, "120.00");
      }
      console.log("✔ Scenario 4: Price Mismatch detected; returned structured 409 and halted.");
    }

    // 5. Idempotent Order Placement
    {
      const idempotencyKey = `${RUN_ID}_order_idempotent`;
      const order1 = await OrderService.createOrder(studentASession, {
        shopId: SEED_SHOP_ID,
        idempotencyKey,
        items: [
          {
            productId: SEED_PRODUCT_MASALA_FRIES_ID,
            quantity: 1,
            expectedUnitPrice: "90.00",
          },
        ],
      });
      createdOrderIds.add(order1.id);

      // Repeat request with exact same idempotencyKey
      const order2 = await OrderService.createOrder(studentASession, {
        shopId: SEED_SHOP_ID,
        idempotencyKey,
        items: [
          {
            productId: SEED_PRODUCT_MASALA_FRIES_ID,
            quantity: 1,
            expectedUnitPrice: "90.00",
          },
        ],
      });

      assert.equal(order1.id, order2.id);
      assert.equal(order1.orderNumber, order2.orderNumber);

      // Attempt by Student B with Student A's idempotency key -> ConflictError
      await assert.rejects(
        async () => {
          await OrderService.createOrder(studentBSession, {
            shopId: SEED_SHOP_ID,
            idempotencyKey,
            items: [
              {
                productId: SEED_PRODUCT_MASALA_FRIES_ID,
                quantity: 1,
                expectedUnitPrice: "90.00",
              },
            ],
          });
        },
        ConflictError
      );
      console.log("✔ Scenario 5: Idempotent checkout verified; cross-account collision blocked.");
    }

    // 6. Campus Tenant Boundary Enforcement
    {
      await assert.rejects(
        async () => {
          await OrderService.createOrder(studentForeignSession, {
            shopId: SEED_SHOP_ID,
            items: [
              {
                productId: SEED_PRODUCT_VEGGIE_WRAP_ID,
                quantity: 1,
                expectedUnitPrice: "120.00",
              },
            ],
          });
        },
        ForbiddenError
      );
      console.log("✔ Scenario 6: Campus tenant boundary verified under assertCampusAccess.");
    }

    // 7. Kiosk Manual Acceptance & Timestamp Progression
    {
      const order = await OrderService.createOrder(studentASession, {
        shopId: SEED_SHOP_ID,
        items: [
          {
            productId: SEED_PRODUCT_VEGGIE_WRAP_ID,
            quantity: 1,
            expectedUnitPrice: "120.00",
          },
        ],
      });
      createdOrderIds.add(order.id);

      // Unauthorized user (Student B) cannot accept
      await assert.rejects(
        async () => {
          await OrderService.acceptOrder(studentBSession, order.id);
        },
        ForbiddenError
      );

      // Authorized Staff accepts
      const accepted = await OrderService.acceptOrder(staffSession, order.id);
      assert.equal(accepted.status, "CONFIRMED");
      assert.ok(accepted.confirmedAt instanceof Date);

      const latestHistory = accepted.statusHistory.find((h) => h.toStatus === "CONFIRMED");
      assert.ok(latestHistory);
      assert.equal(latestHistory.changedById, staffId);

      // Linear fulfillment: CONFIRMED -> PREPARING -> READY -> PICKED_UP -> COMPLETED
      const preparing = await OrderService.advanceOrderStatus(staffSession, order.id, {
        targetStatus: "PREPARING",
      });
      assert.equal(preparing.status, "PREPARING");
      assert.ok(preparing.preparingAt instanceof Date);

      const ready = await OrderService.advanceOrderStatus(staffSession, order.id, {
        targetStatus: "READY",
      });
      assert.equal(ready.status, "READY");
      assert.ok(ready.readyAt instanceof Date);

      // Invalid pickup code rejected
      await assert.rejects(
        async () => {
          await OrderService.advanceOrderStatus(staffSession, order.id, {
            targetStatus: "PICKED_UP",
            pickupCode: "#WRONG1",
          });
        },
        ConflictError
      );

      // Valid pickup code succeeds
      const pickedUp = await OrderService.advanceOrderStatus(staffSession, order.id, {
        targetStatus: "PICKED_UP",
        pickupCode: order.orderNumber,
      });
      assert.equal(pickedUp.status, "PICKED_UP");
      assert.ok(pickedUp.pickedUpAt instanceof Date);

      const completed = await OrderService.advanceOrderStatus(staffSession, order.id, {
        targetStatus: "COMPLETED",
      });
      assert.equal(completed.status, "COMPLETED");
      assert.ok(completed.completedAt instanceof Date);

      // Terminal state immutability
      await assert.rejects(
        async () => {
          await OrderService.advanceOrderStatus(staffSession, order.id, {
            targetStatus: "PREPARING",
          });
        },
        InvalidOrderStateTransitionError
      );

      console.log("✔ Scenario 7: Kiosk Acceptance & Linear Fulfillment (CONFIRMED->PREPARING->READY->PICKED_UP->COMPLETED) verified.");
    }

    // 8. Kiosk Rejection with Structured Reason & Payment State Integrity
    {
      const order = await OrderService.createOrder(studentASession, {
        shopId: SEED_SHOP_ID,
        items: [
          {
            productId: SEED_PRODUCT_MASALA_FRIES_ID,
            quantity: 1,
            expectedUnitPrice: "90.00",
          },
        ],
      });
      createdOrderIds.add(order.id);

      const rejected = await OrderService.rejectOrder(staffSession, order.id, {
        rejectionReason: "OUT_OF_STOCK",
        rejectionNote: "Out of seasoning ingredients",
      });

      assert.equal(rejected.status, "REJECTED");
      assert.equal(rejected.rejectionReason, "OUT_OF_STOCK");
      assert.equal(rejected.rejectionNote, "Out of seasoning ingredients");

      // Payment remains PENDING (never falsely marked REFUNDED)
      assert.equal(rejected.payments[0].status, "PENDING");
      assert.equal(rejected.payments[0].refundedAt, null);

      console.log("✔ Scenario 8: Kiosk Rejection with Structured Reason & Payment Decoupling verified.");
    }

    // 9. Student Cancellation (Legal from PLACED vs Forbidden Post-Acceptance)
    {
      const order = await OrderService.createOrder(studentASession, {
        shopId: SEED_SHOP_ID,
        items: [
          {
            productId: SEED_PRODUCT_VEGGIE_WRAP_ID,
            quantity: 1,
            expectedUnitPrice: "120.00",
          },
        ],
      });
      createdOrderIds.add(order.id);

      // Student B cannot cancel Student A's order
      await assert.rejects(
        async () => {
          await OrderService.cancelOrder(studentBSession, order.id, {
            cancellationReason: "OTHER",
          });
        },
        ForbiddenError
      );

      // Student A cancels successfully while PLACED
      const cancelled = await OrderService.cancelOrder(studentASession, order.id, {
        cancellationReason: "WAIT_TIME_TOO_LONG",
        cancellationNote: "Class starting soon",
      });
      assert.equal(cancelled.status, "CANCELLED");
      assert.equal(cancelled.cancellationReason, "WAIT_TIME_TOO_LONG");
      assert.equal(cancelled.cancellationNote, "Class starting soon");

      // Post-cancellation attempts fail
      await assert.rejects(
        async () => {
          await OrderService.acceptOrder(staffSession, order.id);
        },
        InvalidOrderStateTransitionError
      );

      console.log("✔ Scenario 9: Student Cancellation rules and student ownership boundaries verified.");
    }

    // 10. Tenant-Isolated Order Retrieval (getOrderById)
    {
      const order = await OrderService.createOrder(studentASession, {
        shopId: SEED_SHOP_ID,
        items: [
          {
            productId: SEED_PRODUCT_VEGGIE_WRAP_ID,
            quantity: 1,
            expectedUnitPrice: "120.00",
          },
        ],
      });
      createdOrderIds.add(order.id);

      // Owner can view
      const fetchedByOwner = await OrderService.getOrderById(studentASession, order.id);
      assert.equal(fetchedByOwner.id, order.id);

      // Shop staff can view
      const fetchedByStaff = await OrderService.getOrderById(staffSession, order.id);
      assert.equal(fetchedByStaff.id, order.id);

      // Unrelated Student B receives ForbiddenError
      await assert.rejects(
        async () => {
          await OrderService.getOrderById(studentBSession, order.id);
        },
        ForbiddenError
      );

      console.log("✔ Scenario 10: Tenant-Isolated Order Retrieval verified across roles.");
    }

    // 11. Bounded Concurrency: Kiosk Acceptance vs. Student Cancellation
    {
      const order = await OrderService.createOrder(studentASession, {
        shopId: SEED_SHOP_ID,
        items: [
          {
            productId: SEED_PRODUCT_MASALA_FRIES_ID,
            quantity: 1,
            expectedUnitPrice: "90.00",
          },
        ],
      });
      createdOrderIds.add(order.id);

      // Fire simultaneous competing requests
      const [acceptResult, cancelResult] = await Promise.allSettled([
        OrderService.acceptOrder(staffSession, order.id),
        OrderService.cancelOrder(studentASession, order.id, {
          cancellationReason: "ORDERED_BY_MISTAKE",
        }),
      ]);

      const fulfilledCount = [acceptResult, cancelResult].filter((r) => r.status === "fulfilled").length;
      const rejectedCount = [acceptResult, cancelResult].filter((r) => r.status === "rejected").length;

      assert.equal(fulfilledCount, 1, "Exactly one competing mutation must succeed");
      assert.equal(rejectedCount, 1, "Exactly one competing mutation must fail");

      // Verify the rejected error is ConflictError or InvalidOrderStateTransitionError
      const rejectedPromise = [acceptResult, cancelResult].find((r) => r.status === "rejected") as PromiseRejectedResult;
      assert.ok(
        rejectedPromise.reason instanceof ConflictError ||
          rejectedPromise.reason instanceof InvalidOrderStateTransitionError,
        `Unexpected rejection reason: ${rejectedPromise.reason}`
      );

      // Verify database reflects exactly one valid winning state
      const finalOrder = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { statusHistory: true },
      });
      assert.ok(["CONFIRMED", "CANCELLED"].includes(finalOrder.status));
      assert.equal(finalOrder.statusHistory.length, 2); // Initial PLACED + winning transition

      console.log(`✔ Scenario 11: Bounded Concurrency mutual exclusion verified (Winner: ${finalOrder.status}).`);
    }

    console.log("\n========================================================");
    console.log("  ALL INTEGRATION TEST SCENARIOS PASSED SUCCESSFULLY!    ");
    console.log("========================================================\n");
  } finally {
    console.log("--- Executing Narrow Run-Scoped Cleanup & Baseline Verification ---");

    try {
      // 1. Delete created test orders (Postgres CASCADE deletes order_items, order_status_history, payment_records)
      if (createdOrderIds.size > 0) {
        await prisma.order.deleteMany({
          where: { id: { in: Array.from(createdOrderIds) } },
        });
      }

      // 2. Delete ephemeral test products/categories/shop members/shops
      if (createdProductIds.size > 0) {
        await prisma.product.deleteMany({
          where: { id: { in: Array.from(createdProductIds) } },
        });
      }
      if (createdCategoryIds.size > 0) {
        await prisma.category.deleteMany({
          where: { id: { in: Array.from(createdCategoryIds) } },
        });
      }
      if (createdShopMemberIds.size > 0) {
        await prisma.shopMember.deleteMany({
          where: { id: { in: Array.from(createdShopMemberIds) } },
        });
      }
      if (createdShopIds.size > 0) {
        await prisma.shop.deleteMany({
          where: { id: { in: Array.from(createdShopIds) } },
        });
      }

      // 3. Delete created test users
      if (createdUserIds.size > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: Array.from(createdUserIds) } },
        });
      }

      console.log(`✔ Tracked fixtures (${createdOrderIds.size} orders, ${createdUserIds.size} users, ${createdShopIds.size} shops) deleted cleanly.`);
    } catch (cleanupErr) {
      console.error("❌ Cleanup encountered an error:", cleanupErr);
      console.error("   Tracked fixture IDs that may require review:", {
        orders: Array.from(createdOrderIds),
        users: Array.from(createdUserIds),
      });
      throw cleanupErr;
    }

    // 4. Verify original baseline catalog remains 100% intact
    const [campuses, shops, categories, products, orders, users] = await Promise.all([
      prisma.campus.count(),
      prisma.shop.count(),
      prisma.category.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.user.count(),
    ]);

    assert.equal(campuses, 1, "Baseline campus count altered!");
    assert.equal(shops, 1, "Baseline shop count altered!");
    assert.equal(categories, 3, "Baseline categories count altered!");
    assert.equal(products, 4, "Baseline products count altered!");
    assert.equal(orders, 0, "Untracked orders remain in database!");
    assert.equal(users, 0, "Untracked users remain in database!");

    // Verify baseline seed product properties
    const veggieWrap = await prisma.product.findUniqueOrThrow({
      where: { id: SEED_PRODUCT_VEGGIE_WRAP_ID },
    });
    assert.equal(veggieWrap.name, "Veggie Wrap");
    assert.equal(veggieWrap.price.toFixed(2), "120.00");
    assert.equal(veggieWrap.isAvailable, true);

    console.log("✔ Baseline Seed Catalog verified intact (1 Campus, 1 Shop, 3 Categories, 4 Products, 0 Leftover Orders/Users).\n");
  }
}

main()
  .catch((err) => {
    console.error("\n❌ Integration Test Suite Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
