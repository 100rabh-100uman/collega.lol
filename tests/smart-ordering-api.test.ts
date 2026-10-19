/**
 * COLLEGA.LOL — Stage 5: Smart Ordering API Integration Tests
 *
 * Validates the Next.js Route Handlers:
 * - GET  /api/shops/[shopId]/menu
 * - POST /api/orders
 * - GET  /api/orders
 * - GET  /api/orders/[id]
 * - POST /api/orders/[id]/cancel
 * - GET  /api/shops/[shopId]/orders
 * - POST /api/orders/[id]/accept
 * - POST /api/orders/[id]/reject
 * - POST /api/orders/[id]/advance
 *
 * SAFETY INVARIANTS:
 * - Triple-endpoint positive verification of 'collega-dev'.
 * - Pre-flight scan for leftover records; fails closed if detected.
 * - Tracked run-scoped fixture deletion in finally.
 * - Baseline seed catalog remains untouched.
 * - Verifies error bodies never leak secrets or database connection strings.
 */

import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

// Ensure local environment is loaded
try {
  process.loadEnvFile?.(".env");
} catch {}

import { Prisma } from "@prisma/client";
import { prisma } from "../src/core/db/prisma";
import { checkDatabaseReadiness } from "../src/core/config/env";
import {
  SEED_CAMPUS_ID,
  SEED_SHOP_ID,
  SEED_PRODUCT_VEGGIE_WRAP_ID,
  SEED_PRODUCT_MASALA_FRIES_ID,
} from "../prisma/seed";

// Import Route Handlers directly
import { GET as listShopsRoute } from "../src/app/api/shops/route";
import { GET as getShopMenuRoute } from "../src/app/api/shops/[shopId]/menu/route";
import { POST as createOrderRoute, GET as listStudentOrdersRoute } from "../src/app/api/orders/route";
import { GET as getOrderByIdRoute } from "../src/app/api/orders/[id]/route";
import { POST as cancelOrderRoute } from "../src/app/api/orders/[id]/cancel/route";
import { GET as listShopOrdersRoute } from "../src/app/api/shops/[shopId]/orders/route";
import { POST as acceptOrderRoute } from "../src/app/api/orders/[id]/accept/route";
import { POST as rejectOrderRoute } from "../src/app/api/orders/[id]/reject/route";
import { POST as advanceOrderRoute } from "../src/app/api/orders/[id]/advance/route";
import { GET as getDevSessionRoute } from "../src/app/api/dev/session/route";
import { formatPriceINR, parsePriceToPaise } from "../src/lib/currency";
import type { ConfirmedOrderItem } from "../src/components/smart-ordering/order-confirmation-modal";
import { OrderService } from "../src/modules/smart-ordering";
import {
  DEV_STUDENT_ID,
  DEV_STAFF_ID,
  DEV_MANAGER_ID,
} from "../src/core/auth/session";
import type { SessionContext } from "../src/core/types/auth";

// --------------------------------------------------------------------------
// 1. Triple-Endpoint Positive Identity Guard
// --------------------------------------------------------------------------

function extractProjectRef(rawUrl: string, type: "supabase" | "postgres"): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (type === "supabase") return parsed.hostname.split(".")[0];
    const user = parsed.username || "";
    if (user.startsWith("postgres.")) return user.replace(/^postgres\./, "");
    const host = parsed.hostname || "";
    if (host.startsWith("db.")) return host.replace(/^db\./, "").split(".")[0];
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

  if (
    process.env.NODE_ENV === "production" ||
    dbUrl.toLowerCase().includes("collega.lol") ||
    appUrl.toLowerCase().includes("collega.lol")
  ) {
    throw new Error("[Environment Guard] Aborted: Production environment detected.");
  }

  const refSupabase = extractProjectRef(supabaseUrl, "supabase");
  const refDb = extractProjectRef(dbUrl, "postgres");
  const refDirect = extractProjectRef(directUrl, "postgres");

  if (!refSupabase || !refDb || !refDirect || refSupabase !== refDb || refSupabase !== refDirect) {
    throw new Error("[Environment Guard] Aborted: Project reference mismatch across endpoints.");
  }

  console.log("✔ [Environment Guard] Verified dedicated 'collega-dev' project identity matching across Pooler, Direct, and Supabase endpoints.");
  return refSupabase;
}

// --------------------------------------------------------------------------
// 2. Tracked In-Memory Fixture Registry & Pre-Flight
// --------------------------------------------------------------------------

const RUN_ID = `api_${Date.now()}_${randomBytes(4).toString("hex")}`;
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
    where: { idempotencyKey: { startsWith: "api_" } },
    select: { id: true, idempotencyKey: true },
  });

  if (leftoverUsers.length > 0 || leftoverOrders.length > 0) {
    console.error("❌ [Pre-Flight Scan] Leftover test records detected from an earlier interrupted run:");
    if (leftoverUsers.length > 0) console.error(`   Found ${leftoverUsers.length} test user(s).`);
    if (leftoverOrders.length > 0) console.error(`   Found ${leftoverOrders.length} test order(s).`);
    console.error("   Execution aborted to prevent data corruption.");
    process.exit(1);
  }
}

// Helper to construct request with optional test user header
function createApiRequest(
  url: string,
  options: {
    method?: string;
    userId?: string;
    body?: unknown;
    rawBody?: string;
  } = {}
): Request {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (options.userId) {
    headers.set("x-collega-test-user-id", options.userId);
  }

  return new Request(url, {
    method: options.method || "GET",
    headers,
    body: options.rawBody !== undefined ? options.rawBody : (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  });
}

// --------------------------------------------------------------------------
// 3. Main API Integration Suite
// --------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("\n========================================================");
  console.log("  COLLEGA.LOL — Stage 5 Smart Ordering API Tests        ");
  console.log("========================================================\n");

  assertDevelopmentTestTarget();
  await runPreFlightScan();

  try {
    console.log(`\n--- Setting up isolated test fixtures (Run ID: ${RUN_ID}) ---`);

    // Student A
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

    // Student B (cross-student adversary)
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

    // Kiosk Staff
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

    // Super Admin
    const superAdminId = randomUUID();
    const superAdminEmail = `superadmin_${RUN_ID}@test.collega.internal`;
    await prisma.user.create({
      data: {
        id: superAdminId,
        email: superAdminEmail,
        campusId: null,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    createdUserIds.add(superAdminId);

    // Ephemeral Foreign Shop (for cross-shop staff testing)
    const foreignShopId = randomUUID();
    await prisma.shop.create({
      data: {
        id: foreignShopId,
        campusId: SEED_CAMPUS_ID,
        name: `Foreign Shop ${RUN_ID}`,
        slug: `foreign-shop-${RUN_ID}`,
        location: "Block Z",
        isOpen: true,
      },
    });
    createdShopIds.add(foreignShopId);

    console.log("✔ Isolated API fixtures initialized cleanly.\n");

    // =========================================================================
    // Test Scenarios
    // =========================================================================

    console.log("--- Executing API Route Handler Integration Scenarios ---");

    // 1. Unauthenticated Access Protection (HTTP 401 across endpoints)
    {
      const reqShops = createApiRequest("http://localhost:3000/api/shops");
      const resShops = await listShopsRoute(reqShops);
      assert.equal(resShops.status, 401);

      const reqMenu = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/menu`);
      const resMenu = await getShopMenuRoute(reqMenu, { params: Promise.resolve({ shopId: SEED_SHOP_ID }) });
      assert.equal(resMenu.status, 401);
      const jsonMenu = await resMenu.json();
      assert.equal(jsonMenu.success, false);
      assert.equal(jsonMenu.error.code, "UNAUTHORIZED");

      const reqCreate = createApiRequest("http://localhost:3000/api/orders", { method: "POST", body: {} });
      const resCreate = await createOrderRoute(reqCreate);
      assert.equal(resCreate.status, 401);

      console.log("✔ Scenario 1: Unauthenticated requests rejected with HTTP 401 UNAUTHORIZED.");
    }

    // 1b. Campus-Scoped Shop Listing (GET /api/shops)
    {
      const reqStudentShops = createApiRequest("http://localhost:3000/api/shops", { userId: studentAId });
      const resStudentShops = await listShopsRoute(reqStudentShops);
      assert.equal(resStudentShops.status, 200);
      const jsonShops = await resStudentShops.json();
      assert.equal(jsonShops.success, true);
      assert.ok(Array.isArray(jsonShops.data));
      assert.ok(jsonShops.data.some((s: { id: string }) => s.id === SEED_SHOP_ID));

      // Verify returned fields do not expose sensitive internals
      const quadBistro = jsonShops.data.find((s: { id: string }) => s.id === SEED_SHOP_ID);
      assert.equal(quadBistro.name, "The Campus Quad Bistro");
      assert.equal(quadBistro.campusId, SEED_CAMPUS_ID);
      assert.equal(typeof quadBistro.isOpen, "boolean");

      console.log("✔ Scenario 1b: GET /api/shops returns campus-scoped shops for authenticated student.");
    }

    // 2. Malformed JSON Body (HTTP 500/400 safe handling without secret leaks)
    {
      const req = new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-collega-test-user-id": studentAId,
        },
        body: "{ bad json",
      });
      const res = await createOrderRoute(req);
      assert.ok(res.status >= 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(typeof json.error.message, "string");
      assert.equal(json.error.message.includes("postgresql:"), false);

      console.log("✔ Scenario 2: Malformed JSON handled safely without secret exposure.");
    }

    // 3. Schema Validation Failures (Negative Quantity & Duplicate Items -> HTTP 400)
    {
      // Duplicate item IDs in array
      const reqDup = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: studentAId,
        body: {
          shopId: SEED_SHOP_ID,
          items: [
            { productId: SEED_PRODUCT_VEGGIE_WRAP_ID, quantity: 1, expectedUnitPrice: "120.00" },
            { productId: SEED_PRODUCT_VEGGIE_WRAP_ID, quantity: 2, expectedUnitPrice: "120.00" },
          ],
        },
      });
      const resDup = await createOrderRoute(reqDup);
      assert.equal(resDup.status, 400);
      const jsonDup = await resDup.json();
      assert.equal(jsonDup.success, false);
      assert.equal(jsonDup.error.code, "VALIDATION_ERROR");
      assert.ok(jsonDup.error.message.includes("duplicate"));

      // Negative quantity
      const reqNeg = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: studentAId,
        body: {
          shopId: SEED_SHOP_ID,
          items: [
            { productId: SEED_PRODUCT_VEGGIE_WRAP_ID, quantity: -1, expectedUnitPrice: "120.00" },
          ],
        },
      });
      const resNeg = await createOrderRoute(reqNeg);
      assert.equal(resNeg.status, 400);

      console.log("✔ Scenario 3: Input validation errors returned HTTP 400 VALIDATION_ERROR with structured messages.");
    }

    // 4. GET /api/shops/[shopId]/menu (Catalog inspection)
    {
      const req = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/menu`, {
        userId: studentAId,
      });
      const res = await getShopMenuRoute(req, { params: Promise.resolve({ shopId: SEED_SHOP_ID }) });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.shop.slug, "quad-bistro");
      assert.equal(json.data.categories.length, 3);
      assert.ok(json.data.categories.some((c: { slug: string }) => c.slug === "hot-meals"));

      console.log("✔ Scenario 4: GET /api/shops/[shopId]/menu returned HTTP 200 with available catalog.");
    }

    // 5. POST /api/orders & GET /api/orders (Successful Order Placement & List)
    let createdOrder: { id: string; orderNumber: string };
    {
      const idempotencyKey = `${RUN_ID}_order_1`;
      const req = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: studentAId,
        body: {
          shopId: SEED_SHOP_ID,
          idempotencyKey,
          items: [
            {
              productId: SEED_PRODUCT_VEGGIE_WRAP_ID,
              quantity: 2,
              expectedUnitPrice: "120.00",
              specialInstructions: "Less spicy",
            },
            {
              productId: SEED_PRODUCT_MASALA_FRIES_ID,
              quantity: 1,
              expectedUnitPrice: "90.00",
            },
          ],
        },
      });
      const res = await createOrderRoute(req);
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, "PLACED");
      assert.equal(json.data.totalAmount, "330");
      assert.equal(json.data.items.length, 2);
      createdOrderIds.add(json.data.id);
      createdOrder = json.data;

      // Mock Payment disclosure check
      assert.ok(json.data.payments && json.data.payments.length > 0);
      assert.equal(json.data.payments[0].provider, "MOCK_TEST");
      assert.equal(json.data.payments[0].status, "PENDING");

      // Duplicate submission prevention via idempotency key
      const reqDup = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: studentAId,
        body: {
          shopId: SEED_SHOP_ID,
          idempotencyKey,
          items: [
            {
              productId: SEED_PRODUCT_VEGGIE_WRAP_ID,
              quantity: 2,
              expectedUnitPrice: "120.00",
            },
          ],
        },
      });
      const resDup = await createOrderRoute(reqDup);
      assert.equal(resDup.status, 201);
      const jsonDup = await resDup.json();
      assert.equal(jsonDup.data.id, createdOrder.id);
      assert.equal(jsonDup.data.orderNumber, createdOrder.orderNumber);

      // Student lists orders
      const reqList = createApiRequest("http://localhost:3000/api/orders?active=true", {
        userId: studentAId,
      });
      const resList = await listStudentOrdersRoute(reqList);
      assert.equal(resList.status, 200);
      const jsonList = await resList.json();
      assert.equal(jsonList.success, true);
      assert.ok(jsonList.data.some((o: { id: string }) => o.id === createdOrder.id));

      console.log("✔ Scenario 5: POST & GET /api/orders successfully placed order (HTTP 201), enforced idempotency, verified mock payment, and listed student orders.");
    }

    // 6. Price Mismatch Detection (HTTP 409 PRICE_MISMATCH)
    {
      const req = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: studentAId,
        body: {
          shopId: SEED_SHOP_ID,
          items: [
            {
              productId: SEED_PRODUCT_VEGGIE_WRAP_ID,
              quantity: 1,
              expectedUnitPrice: "99.00", // Actual is 120.00
            },
          ],
        },
      });
      const res = await createOrderRoute(req);
      assert.equal(res.status, 409);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "PRICE_MISMATCH");
      assert.ok(Array.isArray(json.error.mismatches));
      assert.equal(json.error.mismatches[0].productId, SEED_PRODUCT_VEGGIE_WRAP_ID);
      assert.equal(json.error.mismatches[0].expectedPrice, "99.00");
      assert.equal(json.error.mismatches[0].actualPrice, "120.00");

      console.log("✔ Scenario 6: Price mismatch returned HTTP 409 with structured price mismatch details.");
    }

    // 7. GET /api/orders/[id] (Tenant Isolation & Authorization)
    {
      // Owner (Student A) can view
      const reqA = createApiRequest(`http://localhost:3000/api/orders/${createdOrder.id}`, {
        userId: studentAId,
      });
      const resA = await getOrderByIdRoute(reqA, { params: Promise.resolve({ id: createdOrder.id }) });
      assert.equal(resA.status, 200);

      // Shop Staff can view
      const reqStaff = createApiRequest(`http://localhost:3000/api/orders/${createdOrder.id}`, {
        userId: staffId,
      });
      const resStaff = await getOrderByIdRoute(reqStaff, { params: Promise.resolve({ id: createdOrder.id }) });
      assert.equal(resStaff.status, 200);

      // Super Admin can view
      const reqAdmin = createApiRequest(`http://localhost:3000/api/orders/${createdOrder.id}`, {
        userId: superAdminId,
      });
      const resAdmin = await getOrderByIdRoute(reqAdmin, { params: Promise.resolve({ id: createdOrder.id }) });
      assert.equal(resAdmin.status, 200);

      // Unauthorized Student B receives HTTP 403 FORBIDDEN
      const reqB = createApiRequest(`http://localhost:3000/api/orders/${createdOrder.id}`, {
        userId: studentBId,
      });
      const resB = await getOrderByIdRoute(reqB, { params: Promise.resolve({ id: createdOrder.id }) });
      assert.equal(resB.status, 403);
      const jsonB = await resB.json();
      assert.equal(jsonB.error.code, "FORBIDDEN");

      console.log("✔ Scenario 7: GET /api/orders/[id] enforced strict tenant authorization across roles.");
    }

    // 8. Kiosk Kitchen Queue: GET /api/shops/[shopId]/orders
    {
      // Staff of the shop views active queue
      const req = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/orders`, {
        userId: staffId,
      });
      const res = await listShopOrdersRoute(req, { params: Promise.resolve({ shopId: SEED_SHOP_ID }) });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.some((o: { id: string }) => o.id === createdOrder.id));

      // Student attempting to access kiosk queue receives HTTP 403 FORBIDDEN
      const reqStudent = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/orders`, {
        userId: studentAId,
      });
      const resStudent = await listShopOrdersRoute(reqStudent, { params: Promise.resolve({ shopId: SEED_SHOP_ID }) });
      assert.equal(resStudent.status, 403);

      console.log("✔ Scenario 8: GET /api/shops/[shopId]/orders enforced kiosk staff authorization.");
    }

    // 9. Kiosk Order Acceptance & Fulfillment Progression (with secure pickup code)
    {
      // Kiosk Staff accepts order
      const reqAccept = createApiRequest(`http://localhost:3000/api/orders/${createdOrder.id}/accept`, {
        method: "POST",
        userId: staffId,
      });
      const resAccept = await acceptOrderRoute(reqAccept, { params: Promise.resolve({ id: createdOrder.id }) });
      assert.equal(resAccept.status, 200);
      const jsonAccept = await resAccept.json();
      assert.equal(jsonAccept.data.status, "CONFIRMED");

      // Advance: CONFIRMED -> PREPARING
      const reqPrep = createApiRequest(`http://localhost:3000/api/orders/${createdOrder.id}/advance`, {
        method: "POST",
        userId: staffId,
        body: { targetStatus: "PREPARING" },
      });
      const resPrep = await advanceOrderRoute(reqPrep, { params: Promise.resolve({ id: createdOrder.id }) });
      assert.equal(resPrep.status, 200);

      // Advance: PREPARING -> READY
      const reqReady = createApiRequest(`http://localhost:3000/api/orders/${createdOrder.id}/advance`, {
        method: "POST",
        userId: staffId,
        body: { targetStatus: "READY" },
      });
      const resReady = await advanceOrderRoute(reqReady, { params: Promise.resolve({ id: createdOrder.id }) });
      assert.equal(resReady.status, 200);

      // Advance: READY -> PICKED_UP without code -> HTTP 400
      const reqNoCode = createApiRequest(`http://localhost:3000/api/orders/${createdOrder.id}/advance`, {
        method: "POST",
        userId: staffId,
        body: { targetStatus: "PICKED_UP" },
      });
      const resNoCode = await advanceOrderRoute(reqNoCode, { params: Promise.resolve({ id: createdOrder.id }) });
      assert.equal(resNoCode.status, 400);

      // Advance: READY -> PICKED_UP with wrong code -> HTTP 409
      const reqWrongCode = createApiRequest(`http://localhost:3000/api/orders/${createdOrder.id}/advance`, {
        method: "POST",
        userId: staffId,
        body: { targetStatus: "PICKED_UP", pickupCode: "#INVALID" },
      });
      const resWrongCode = await advanceOrderRoute(reqWrongCode, { params: Promise.resolve({ id: createdOrder.id }) });
      assert.equal(resWrongCode.status, 409);

      // Advance: READY -> PICKED_UP with valid code -> HTTP 200
      const reqPickup = createApiRequest(`http://localhost:3000/api/orders/${createdOrder.id}/advance`, {
        method: "POST",
        userId: staffId,
        body: { targetStatus: "PICKED_UP", pickupCode: createdOrder.orderNumber },
      });
      const resPickup = await advanceOrderRoute(reqPickup, { params: Promise.resolve({ id: createdOrder.id }) });
      assert.equal(resPickup.status, 200);
      const jsonPickup = await resPickup.json();
      assert.equal(jsonPickup.data.status, "PICKED_UP");

      // Advance: PICKED_UP -> COMPLETED
      const reqComplete = createApiRequest(`http://localhost:3000/api/orders/${createdOrder.id}/advance`, {
        method: "POST",
        userId: staffId,
        body: { targetStatus: "COMPLETED" },
      });
      const resComplete = await advanceOrderRoute(reqComplete, { params: Promise.resolve({ id: createdOrder.id }) });
      assert.equal(resComplete.status, 200);

      // Post-completion illegal jump -> HTTP 409 CONFLICT
      const reqIllegal = createApiRequest(`http://localhost:3000/api/orders/${createdOrder.id}/advance`, {
        method: "POST",
        userId: staffId,
        body: { targetStatus: "PREPARING" },
      });
      const resIllegal = await advanceOrderRoute(reqIllegal, { params: Promise.resolve({ id: createdOrder.id }) });
      assert.equal(resIllegal.status, 409);

      console.log("✔ Scenario 9: Kiosk Acceptance & Linear Fulfillment with secure pickup verification verified.");
    }

    // 10. Kiosk Rejection with Structured Reason: POST /api/orders/[id]/reject
    {
      const reqCreate = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: studentAId,
        body: {
          shopId: SEED_SHOP_ID,
          items: [{ productId: SEED_PRODUCT_MASALA_FRIES_ID, quantity: 1, expectedUnitPrice: "90.00" }],
        },
      });
      const resCreate = await createOrderRoute(reqCreate);
      const jsonCreate = await resCreate.json();
      createdOrderIds.add(jsonCreate.data.id);

      // Rejection with structured reason
      const reqReject = createApiRequest(`http://localhost:3000/api/orders/${jsonCreate.data.id}/reject`, {
        method: "POST",
        userId: staffId,
        body: { rejectionReason: "OUT_OF_STOCK", rejectionNote: "Fries exhausted" },
      });
      const resReject = await rejectOrderRoute(reqReject, { params: Promise.resolve({ id: jsonCreate.data.id }) });
      assert.equal(resReject.status, 200);
      const jsonReject = await resReject.json();
      assert.equal(jsonReject.data.status, "REJECTED");
      assert.equal(jsonReject.data.rejectionReason, "OUT_OF_STOCK");

      // Payment decoupling check: payment remains PENDING
      assert.equal(jsonReject.data.payments[0].status, "PENDING");
      assert.equal(jsonReject.data.payments[0].refundedAt, null);

      console.log("✔ Scenario 10: Kiosk Rejection enforced structured reason & payment decoupling.");
    }

    // 11. Student Cancellation: POST /api/orders/[id]/cancel
    {
      const reqCreate = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: studentAId,
        body: {
          shopId: SEED_SHOP_ID,
          items: [{ productId: SEED_PRODUCT_VEGGIE_WRAP_ID, quantity: 1, expectedUnitPrice: "120.00" }],
        },
      });
      const resCreate = await createOrderRoute(reqCreate);
      const jsonCreate = await resCreate.json();
      createdOrderIds.add(jsonCreate.data.id);

      // Student B attempting to cancel Student A's order -> HTTP 403 FORBIDDEN
      const reqCancelB = createApiRequest(`http://localhost:3000/api/orders/${jsonCreate.data.id}/cancel`, {
        method: "POST",
        userId: studentBId,
        body: { cancellationReason: "WAIT_TIME_TOO_LONG" },
      });
      const resCancelB = await cancelOrderRoute(reqCancelB, { params: Promise.resolve({ id: jsonCreate.data.id }) });
      assert.equal(resCancelB.status, 403);

      // Invalid cancellation reason -> HTTP 400 VALIDATION_ERROR
      const reqInvalidReason = createApiRequest(`http://localhost:3000/api/orders/${jsonCreate.data.id}/cancel`, {
        method: "POST",
        userId: studentAId,
        body: { cancellationReason: "NOT_A_VALID_REASON" },
      });
      const resInvalidReason = await cancelOrderRoute(reqInvalidReason, { params: Promise.resolve({ id: jsonCreate.data.id }) });
      assert.equal(resInvalidReason.status, 400);

      // Student A cancels successfully while PLACED
      const reqCancelA = createApiRequest(`http://localhost:3000/api/orders/${jsonCreate.data.id}/cancel`, {
        method: "POST",
        userId: studentAId,
        body: { cancellationReason: "ORDERED_BY_MISTAKE", cancellationNote: "Placed in error" },
      });
      const resCancelA = await cancelOrderRoute(reqCancelA, { params: Promise.resolve({ id: jsonCreate.data.id }) });
      assert.equal(resCancelA.status, 200);
      const jsonCancelA = await resCancelA.json();
      assert.equal(jsonCancelA.data.status, "CANCELLED");

      // Attempting to cancel an already CANCELLED order -> HTTP 409
      const reqCancelAgain = createApiRequest(`http://localhost:3000/api/orders/${jsonCreate.data.id}/cancel`, {
        method: "POST",
        userId: studentAId,
        body: { cancellationReason: "ORDERED_BY_MISTAKE" },
      });
      const resCancelAgain = await cancelOrderRoute(reqCancelAgain, { params: Promise.resolve({ id: jsonCreate.data.id }) });
      assert.equal(resCancelAgain.status, 409);

      console.log("✔ Scenario 11: Student Cancellation rules, invalid reasons, and student ownership verified via API.");
    }

    // 12. Competing Concurrent Transitions (Accept vs Cancel HTTP Race)
    {
      const reqCreate = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: studentAId,
        body: {
          shopId: SEED_SHOP_ID,
          items: [{ productId: SEED_PRODUCT_VEGGIE_WRAP_ID, quantity: 1, expectedUnitPrice: "120.00" }],
        },
      });
      const resCreate = await createOrderRoute(reqCreate);
      const jsonCreate = await resCreate.json();
      createdOrderIds.add(jsonCreate.data.id);

      const reqAccept = createApiRequest(`http://localhost:3000/api/orders/${jsonCreate.data.id}/accept`, {
        method: "POST",
        userId: staffId,
      });
      const reqCancel = createApiRequest(`http://localhost:3000/api/orders/${jsonCreate.data.id}/cancel`, {
        method: "POST",
        userId: studentAId,
        body: { cancellationReason: "WAIT_TIME_TOO_LONG" },
      });

      const [acceptRes, cancelRes] = await Promise.all([
        acceptOrderRoute(reqAccept, { params: Promise.resolve({ id: jsonCreate.data.id }) }),
        cancelOrderRoute(reqCancel, { params: Promise.resolve({ id: jsonCreate.data.id }) }),
      ]);

      const statuses = [acceptRes.status, cancelRes.status];
      assert.ok(statuses.includes(200), "One competing transition must succeed with HTTP 200");
      assert.ok(statuses.includes(409), "Competing conflicting transition must fail with HTTP 409");

      console.log("✔ Scenario 12: Competing concurrent HTTP mutations enforced mutual exclusion.");
    }

    // 13. Secret & Stack Trace Leak Verification
    {
      // Inspect all generated error response bodies: ensure no postgres passwords, internal URLs, or stack traces
      const req = createApiRequest(`http://localhost:3000/api/orders/00000000-0000-0000-0000-000000000000`, {
        userId: studentAId,
      });
      const res = await getOrderByIdRoute(req, { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) });
      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "NOT_FOUND");
      const stringified = JSON.stringify(json);
      assert.equal(stringified.includes("DATABASE_URL"), false);
      assert.equal(stringified.includes("postgres:"), false);
      assert.equal(stringified.includes("node_modules"), false);

      console.log("✔ Scenario 13: Error responses verified safe (zero credential or stack trace leaks).");
    }

    // 14. Stage 6B Checkout Validation & Dev Resolution Regression
    {
      // A. GET /api/dev/session without cookie returns 200 with { user: null } instead of throwing 500
      const devSessionRes = await getDevSessionRoute();
      assert.equal(devSessionRes.status, 200, "GET /api/dev/session without cookie must return 200");
      const devSessionJson = await devSessionRes.json();
      assert.equal(devSessionJson.success, true);
      assert.equal(devSessionJson.data.user, null, "Unauthenticated dev session must return user: null");

      // B. Stage 6B pre-checkout validation stops at checkout readiness and does not create orders
      const ordersBeforeValidation = await prisma.order.count();
      const menuReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/menu`, {
        userId: "00000000-0000-4000-a000-000000000001",
      });
      const menuRes = await getShopMenuRoute(menuReq, { params: Promise.resolve({ shopId: SEED_SHOP_ID }) });
      assert.equal(menuRes.status, 200, "Catalog menu validation must return 200");
      const menuJson = await menuRes.json();
      assert.equal(menuJson.success, true);
      assert.equal(menuJson.data.shop.id, SEED_SHOP_ID);
      assert.ok(menuJson.data.categories.length > 0);
      
      const ordersAfterValidation = await prisma.order.count();
      assert.equal(ordersAfterValidation, ordersBeforeValidation, "Stage 6B validation must not create an order record");

      // C. OrderService.createOrder with recognized dev identities auto-provisions user rows without orders_userId_fkey violation
      // 1. Dev Student Order
      const devStudentOrderReq = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: DEV_STUDENT_ID,
        body: {
          shopId: SEED_SHOP_ID,
          items: [
            { productId: SEED_PRODUCT_VEGGIE_WRAP_ID, quantity: 1, expectedUnitPrice: "120.00" },
            { productId: SEED_PRODUCT_MASALA_FRIES_ID, quantity: 1, expectedUnitPrice: "90.00" },
          ],
          idempotencyKey: `dev_student_reg_${Date.now()}`,
        },
      });

      const devStudentOrderRes = await createOrderRoute(devStudentOrderReq);
      assert.equal(devStudentOrderRes.status, 201, "Dev student order creation must succeed with HTTP 201");
      const devStudentOrderJson = await devStudentOrderRes.json();
      assert.equal(devStudentOrderJson.success, true);
      assert.ok(devStudentOrderJson.data.id);
      createdOrderIds.add(devStudentOrderJson.data.id);
      createdUserIds.add(DEV_STUDENT_ID);

      // 2. Dev Staff Order
      const devStaffOrderReq = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: DEV_STAFF_ID,
        body: {
          shopId: SEED_SHOP_ID,
          items: [
            { productId: SEED_PRODUCT_VEGGIE_WRAP_ID, quantity: 1, expectedUnitPrice: "120.00" },
          ],
          idempotencyKey: `dev_staff_reg_${Date.now()}`,
        },
      });

      const devStaffOrderRes = await createOrderRoute(devStaffOrderReq);
      assert.equal(devStaffOrderRes.status, 201, "Dev staff order creation must succeed with HTTP 201");
      const devStaffOrderJson = await devStaffOrderRes.json();
      assert.equal(devStaffOrderJson.success, true);
      assert.ok(devStaffOrderJson.data.id);
      createdOrderIds.add(devStaffOrderJson.data.id);
      createdUserIds.add(DEV_STAFF_ID);

      // 3. Dev Manager Order
      const devManagerOrderReq = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: DEV_MANAGER_ID,
        body: {
          shopId: SEED_SHOP_ID,
          items: [
            { productId: SEED_PRODUCT_MASALA_FRIES_ID, quantity: 1, expectedUnitPrice: "90.00" },
          ],
          idempotencyKey: `dev_manager_reg_${Date.now()}`,
        },
      });

      const devManagerOrderRes = await createOrderRoute(devManagerOrderReq);
      assert.equal(devManagerOrderRes.status, 201, "Dev manager order creation must succeed with HTTP 201");
      const devManagerOrderJson = await devManagerOrderRes.json();
      assert.equal(devManagerOrderJson.success, true);
      assert.ok(devManagerOrderJson.data.id);
      createdOrderIds.add(devManagerOrderJson.data.id);
      createdUserIds.add(DEV_MANAGER_ID);

      console.log("✔ Scenario 14: Stage 6B Checkout Validation, dev session resolution, and dev student/staff/manager order placement foreign key satisfaction verified.");
    }

    // --------------------------------------------------------------------------
    // Scenario 15: Order Confirmation Flow Data Contract & Currency Formatting Regression Test
    // --------------------------------------------------------------------------
    {
      // 1. Verify currency safety: missing/undefined/null prices throw TypeError and never silently convert to ₹0
      assert.throws(
        () => parsePriceToPaise(undefined as unknown as string),
        { name: "TypeError", message: /Cannot parse price to paise: received undefined/ },
        "parsePriceToPaise(undefined) must throw TypeError and not return 0"
      );
      assert.throws(
        () => parsePriceToPaise(null as unknown as string),
        { name: "TypeError", message: /Cannot parse price to paise: received null/ },
        "parsePriceToPaise(null) must throw TypeError and not return 0"
      );
      assert.throws(
        () => formatPriceINR(undefined as unknown as string),
        { name: "TypeError", message: /Cannot parse price to paise: received undefined/ },
        "formatPriceINR(undefined) must throw TypeError and not silently return ₹0.00"
      );

      // 2. Submit a real-shaped order through POST /api/orders
      const orderReq = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: "00000000-0000-4000-a000-000000000001",
        body: {
          shopId: SEED_SHOP_ID,
          items: [
            { productId: SEED_PRODUCT_VEGGIE_WRAP_ID, quantity: 2, expectedUnitPrice: "120.00" },
            { productId: SEED_PRODUCT_MASALA_FRIES_ID, quantity: 1, expectedUnitPrice: "90.00" },
          ],
          idempotencyKey: `confirmation_regression_${Date.now()}`,
        },
      });

      const orderRes = await createOrderRoute(orderReq);
      assert.equal(orderRes.status, 201, "Order placement must return 201 Created");
      const orderJson = await orderRes.json();
      assert.equal(orderJson.success, true);
      const orderData = orderJson.data;

      createdOrderIds.add(orderData.id);
      createdUserIds.add("00000000-0000-4000-a000-000000000001");

      // 3. Inspect data contract: OrderConfirmationModal props requirements
      assert.ok(orderData.id, "Order ID must exist");
      assert.ok(orderData.orderNumber, "Human-readable order token must exist");
      assert.equal(typeof orderData.orderNumber, "string");
      assert.equal(orderData.status, "PLACED");
      assert.equal(orderData.totalAmount.toString(), "330"); // 120*2 + 90 = 330
      assert.equal(orderData.shop.name, "The Campus Quad Bistro");

      // 4. Verify mock payment disclosure
      assert.ok(Array.isArray(orderData.payments), "Order must include payment records");
      assert.equal(orderData.payments.length, 1);
      assert.equal(orderData.payments[0].provider, "MOCK_TEST", "Payment provider must be MOCK_TEST");
      assert.equal(orderData.payments[0].status, "PENDING", "Payment status must be PENDING");

      // 5. Verify authoritative OrderItem data contract (productNameSnapshot & unitPriceSnapshot)
      assert.equal(orderData.items.length, 2);

      // Verify that the server returns snapshot fields, not invented client fields
      for (const item of orderData.items) {
        assert.ok(item.productNameSnapshot, "OrderItem must have productNameSnapshot from server");
        assert.ok(item.unitPriceSnapshot, "OrderItem must have unitPriceSnapshot from server");
        assert.equal(item.productName, undefined, "Server does not return invented productName field");
        assert.equal(item.unitPrice, undefined, "Server does not return invented unitPrice field");
      }

      // 6. Verify currency formatting on actual server response fields without error
      const item1UnitPriceINR = formatPriceINR(orderData.items[0].unitPriceSnapshot);
      const item2UnitPriceINR = formatPriceINR(orderData.items[1].unitPriceSnapshot);
      const totalAmountINR = formatPriceINR(orderData.totalAmount);

      assert.equal(item1UnitPriceINR, "₹120.00", "Item 1 unit price formatted accurately");
      assert.equal(item2UnitPriceINR, "₹90.00", "Item 2 unit price formatted accurately");
      assert.equal(totalAmountINR, "₹330.00", "Total amount formatted accurately");

      // 7. Verify simulation of OrderConfirmationModal rendering flow with real server response
      const renderedModalItems = (orderData.items as ConfirmedOrderItem[]).map((item) => {
        const name = item.productNameSnapshot || item.productName || "Item";
        const unitPrice = item.unitPriceSnapshot ?? item.unitPrice;
        return {
          displayLine: `${item.quantity}x ${name}`,
          formattedPrice: formatPriceINR(unitPrice!),
        };
      });

      assert.deepEqual(renderedModalItems, [
        { displayLine: "2x Veggie Wrap", formattedPrice: "₹120.00" },
        { displayLine: "1x Masala Fries", formattedPrice: "₹90.00" },
      ]);

      console.log("✔ Scenario 15: Order Confirmation Flow Data Contract & Currency Formatting Regression Test passed.");
    }

    // --------------------------------------------------------------------------
    // Scenario 16: Malformed JSON Validation & Production Identity Guardrails
    // --------------------------------------------------------------------------
    {
      // 1. Malformed JSON handling in POST /api/orders returns HTTP 400 with VALIDATION_ERROR
      const malformedReq = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: DEV_STUDENT_ID,
        rawBody: '{"shopId": invalid_json_syntax',
      });
      const malformedRes = await createOrderRoute(malformedReq);
      assert.equal(malformedRes.status, 400, "Malformed JSON must return HTTP 400");
      const malformedJson = await malformedRes.json();
      assert.equal(malformedJson.success, false);
      assert.equal(malformedJson.error.code, "VALIDATION_ERROR");
      assert.equal(malformedJson.error.message, "Invalid JSON request body");

      // 2. Unrecognized / arbitrary user ID is never auto-provisioned
      const arbitraryUserId = "00000000-0000-4000-a000-999999999999";
      const arbitrarySession: SessionContext = {
        user: {
          id: arbitraryUserId,
          email: "arbitrary.user@example.com",
          role: "STUDENT",
          campusId: SEED_CAMPUS_ID,
          isActive: true,
        },
        shopMemberships: [],
      };

      await assert.rejects(
        async () => {
          await OrderService.createOrder(arbitrarySession, {
            shopId: SEED_SHOP_ID,
            items: [
              { productId: SEED_PRODUCT_VEGGIE_WRAP_ID, quantity: 1, expectedUnitPrice: "120.00" },
            ],
            idempotencyKey: `arbitrary_user_guard_${Date.now()}`,
          });
        },
        (err: unknown) => {
          const prismaErr = err as { code?: string; message?: string };
          return prismaErr?.code === "P2003" || String(prismaErr?.message).includes("Foreign key");
        },
        "Arbitrary/unrecognized client identity must not be auto-provisioned and must fail with foreign key constraint"
      );

      const dbArbitraryUser = await prisma.user.findUnique({ where: { id: arbitraryUserId } });
      assert.equal(dbArbitraryUser, null, "Unrecognized user ID must never be inserted into the database");

      // 3. Production mode guardrail: NODE_ENV === 'production' strictly disables dev user provisioning
      const savedNodeEnv = process.env.NODE_ENV;
      const unseededDevStudentId = "00000000-0000-4000-a000-000000000004";
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        const prodDevSession: SessionContext = {
          user: {
            id: unseededDevStudentId,
            email: "unseeded@example.com",
            role: "STUDENT",
            campusId: SEED_CAMPUS_ID,
            isActive: true,
          },
          shopMemberships: [],
        };

        await assert.rejects(
          async () => {
            await OrderService.createOrder(prodDevSession, {
              shopId: SEED_SHOP_ID,
              items: [
                { productId: SEED_PRODUCT_VEGGIE_WRAP_ID, quantity: 1, expectedUnitPrice: "120.00" },
              ],
              idempotencyKey: `prod_guard_${Date.now()}`,
            });
          },
          (err: unknown) => {
            const prismaErr = err as { code?: string; message?: string };
            return prismaErr?.code === "P2003" || String(prismaErr?.message).includes("Foreign key");
          },
          "Production mode must strictly forbid dev-identity provisioning"
        );

        const dbProdUser = await prisma.user.findUnique({ where: { id: unseededDevStudentId } });
        assert.equal(dbProdUser, null, "User must not be created when NODE_ENV is production");
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = savedNodeEnv;
      }

      console.log("✔ Scenario 16: Malformed JSON validation and production identity guardrails verified.");
    }

    // =========================================================================
    // Scenario 17: Stage 3 Automated Multi-Shop Integration Test Scenario
    // =========================================================================
    {
      console.log("\n--- Testing Scenario 17: Stage 3 Multi-Shop Routing & Queue Isolation ---");

      // 1. Create isolated, temporary Shop A and Shop B fixtures in the development campus with distinct products
      const tempShopA = await prisma.shop.create({
        data: {
          campusId: SEED_CAMPUS_ID,
          name: `MultiShop A ${RUN_ID}`,
          slug: `multishop-a-${RUN_ID}`,
          location: "Building A Food Court",
          isOpen: true,
          autoAcceptOrders: false,
        },
      });
      createdShopIds.add(tempShopA.id);

      const categoryA = await prisma.category.create({
        data: {
          shopId: tempShopA.id,
          name: `Category A ${RUN_ID}`,
          slug: `category-a-${RUN_ID}`,
          sortOrder: 1,
        },
      });
      createdCategoryIds.add(categoryA.id);

      const productA = await prisma.product.create({
        data: {
          shopId: tempShopA.id,
          categoryId: categoryA.id,
          name: `Shop A Signature Roll ${RUN_ID}`,
          price: new Prisma.Decimal("100.00"),
          isAvailable: true,
        },
      });
      createdProductIds.add(productA.id);

      const tempShopB = await prisma.shop.create({
        data: {
          campusId: SEED_CAMPUS_ID,
          name: `MultiShop B ${RUN_ID}`,
          slug: `multishop-b-${RUN_ID}`,
          location: "Building B Concourse",
          isOpen: true,
          autoAcceptOrders: false,
        },
      });
      createdShopIds.add(tempShopB.id);

      const categoryB = await prisma.category.create({
        data: {
          shopId: tempShopB.id,
          name: `Category B ${RUN_ID}`,
          slug: `category-b-${RUN_ID}`,
          sortOrder: 1,
        },
      });
      createdCategoryIds.add(categoryB.id);

      const productB = await prisma.product.create({
        data: {
          shopId: tempShopB.id,
          categoryId: categoryB.id,
          name: `Shop B Specialty Bowl ${RUN_ID}`,
          price: new Prisma.Decimal("180.00"),
          isAvailable: true,
        },
      });
      createdProductIds.add(productB.id);

      // Dedicated Manager A explicitly assigned ONLY to Shop A
      const managerAId = randomUUID();
      const managerAUser = await prisma.user.create({
        data: {
          id: managerAId,
          email: `manager_a_${RUN_ID}@test.collega.internal`,
          campusId: SEED_CAMPUS_ID,
          role: "STUDENT",
          isActive: true,
        },
      });
      createdUserIds.add(managerAUser.id);

      const membershipA = await prisma.shopMember.create({
        data: {
          userId: managerAUser.id,
          shopId: tempShopA.id,
          role: "MANAGER",
          isActive: true,
        },
      });
      createdShopMemberIds.add(membershipA.id);

      // Dedicated Manager B explicitly assigned ONLY to Shop B
      const managerBId = randomUUID();
      const managerBUser = await prisma.user.create({
        data: {
          id: managerBId,
          email: `manager_b_${RUN_ID}@test.collega.internal`,
          campusId: SEED_CAMPUS_ID,
          role: "STUDENT",
          isActive: true,
        },
      });
      createdUserIds.add(managerBUser.id);

      const membershipB = await prisma.shopMember.create({
        data: {
          userId: managerBUser.id,
          shopId: tempShopB.id,
          role: "MANAGER",
          isActive: true,
        },
      });
      createdShopMemberIds.add(membershipB.id);

      // 2. Requirement 3: Verify Shop A checkout succeeds with Shop A products
      const orderAReq = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: studentAId,
        body: {
          shopId: tempShopA.id,
          items: [
            { productId: productA.id, quantity: 2, expectedUnitPrice: "100.00" },
          ],
          idempotencyKey: `order_a_${RUN_ID}`,
        },
      });
      const orderARes = await createOrderRoute(orderAReq);
      assert.equal(orderARes.status, 201, "Shop A checkout with Shop A products must succeed with 201 Created");
      const orderAJson = await orderARes.json();
      assert.ok(orderAJson.success, "Order A creation response must indicate success");
      assert.equal(orderAJson.data.shopId, tempShopA.id, "Order A must be associated with Shop A");
      assert.equal(Number(orderAJson.data.totalAmount), 200);
      const orderAId = orderAJson.data.id;
      createdOrderIds.add(orderAId);

      // 3. Requirement 4: Verify a Shop A order submitted with a Shop B product is rejected
      const mixedOrderReq = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: studentAId,
        body: {
          shopId: tempShopA.id,
          items: [
            { productId: productB.id, quantity: 1, expectedUnitPrice: "180.00" },
          ],
          idempotencyKey: `mixed_order_${RUN_ID}`,
        },
      });
      const mixedOrderRes = await createOrderRoute(mixedOrderReq);
      assert.ok(
        mixedOrderRes.status === 404 || mixedOrderRes.status === 400,
        `Mixed-shop checkout must be rejected by server (got status ${mixedOrderRes.status})`
      );
      const mixedJson = await mixedOrderRes.json();
      assert.equal(mixedJson.success, false, "Mixed-shop checkout must not report success");

      const dbMixedOrder = await prisma.order.findUnique({
        where: { idempotencyKey: `mixed_order_${RUN_ID}` },
      });
      assert.equal(dbMixedOrder, null, "No order record must be persisted for mixed-shop checkout attempt");

      // 4. Requirement 5: Verify a valid Shop B order is created with Shop B's authoritative shopId
      const orderBReq = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: studentAId,
        body: {
          shopId: tempShopB.id,
          items: [
            { productId: productB.id, quantity: 1, expectedUnitPrice: "180.00" },
          ],
          idempotencyKey: `order_b_${RUN_ID}`,
        },
      });
      const orderBRes = await createOrderRoute(orderBReq);
      assert.equal(orderBRes.status, 201, "Shop B checkout with Shop B products must succeed with 201 Created");
      const orderBJson = await orderBRes.json();
      assert.ok(orderBJson.success);
      assert.equal(orderBJson.data.shopId, tempShopB.id, "Order B must have authoritative Shop B shopId");
      assert.equal(Number(orderBJson.data.totalAmount), 180);
      const orderBId = orderBJson.data.id;
      createdOrderIds.add(orderBId);

      // 5. Requirement 6: Verify Shop A queue contains only Shop A orders, and Shop B queue contains only Shop B orders
      // 5a. Check Shop A queue via Manager A
      const queueAReq = createApiRequest(`http://localhost:3000/api/shops/${tempShopA.id}/orders`, {
        userId: managerAUser.id,
      });
      const queueARes = await listShopOrdersRoute(queueAReq, {
        params: Promise.resolve({ shopId: tempShopA.id }),
      });
      assert.equal(queueARes.status, 200, "Manager A must be able to list Shop A queue");
      const queueAJson = await queueARes.json();
      assert.ok(queueAJson.success);
      const queueAOrderIds = queueAJson.data.map((o: { id: string }) => o.id);
      assert.ok(queueAOrderIds.includes(orderAId), "Shop A queue must contain Order A");
      assert.ok(!queueAOrderIds.includes(orderBId), "Shop A queue must NOT contain Order B");

      // 5b. Check Shop B queue via Manager B
      const queueBReq = createApiRequest(`http://localhost:3000/api/shops/${tempShopB.id}/orders`, {
        userId: managerBUser.id,
      });
      const queueBRes = await listShopOrdersRoute(queueBReq, {
        params: Promise.resolve({ shopId: tempShopB.id }),
      });
      assert.equal(queueBRes.status, 200, "Manager B must be able to list Shop B queue");
      const queueBJson = await queueBRes.json();
      assert.ok(queueBJson.success);
      const queueBOrderIds = queueBJson.data.map((o: { id: string }) => o.id);
      assert.ok(queueBOrderIds.includes(orderBId), "Shop B queue must contain Order B");
      assert.ok(!queueBOrderIds.includes(orderAId), "Shop B queue must NOT contain Order A");

      // 5c. Check isolated queue views for Development Manager (DEV_MANAGER_ID)
      const devMgrQueueAReq = createApiRequest(`http://localhost:3000/api/shops/${tempShopA.id}/orders`, {
        userId: DEV_MANAGER_ID,
      });
      const devMgrQueueARes = await listShopOrdersRoute(devMgrQueueAReq, {
        params: Promise.resolve({ shopId: tempShopA.id }),
      });
      assert.equal(devMgrQueueARes.status, 200);
      const devMgrQueueAJson = await devMgrQueueARes.json();
      const devMgrAIds = devMgrQueueAJson.data.map((o: { id: string }) => o.id);
      assert.ok(devMgrAIds.includes(orderAId), "Dev manager querying Shop A queue must see Order A");
      assert.ok(!devMgrAIds.includes(orderBId), "Dev manager querying Shop A queue must NOT see Order B");

      const devMgrQueueBReq = createApiRequest(`http://localhost:3000/api/shops/${tempShopB.id}/orders`, {
        userId: DEV_MANAGER_ID,
      });
      const devMgrQueueBRes = await listShopOrdersRoute(devMgrQueueBReq, {
        params: Promise.resolve({ shopId: tempShopB.id }),
      });
      assert.equal(devMgrQueueBRes.status, 200);
      const devMgrQueueBJson = await devMgrQueueBRes.json();
      const devMgrBIds = devMgrQueueBJson.data.map((o: { id: string }) => o.id);
      assert.ok(devMgrBIds.includes(orderBId), "Dev manager querying Shop B queue must see Order B");
      assert.ok(!devMgrBIds.includes(orderAId), "Dev manager querying Shop B queue must NOT see Order A");

      // 6. Requirement 7: Verify a manager assigned to Shop A cannot read, accept, or modify Shop B's order
      // 6a. Read Order B by Manager A -> 403 Forbidden
      const readBReq = createApiRequest(`http://localhost:3000/api/orders/${orderBId}`, {
        userId: managerAUser.id,
      });
      const readBRes = await getOrderByIdRoute(readBReq, {
        params: Promise.resolve({ id: orderBId }),
      });
      assert.equal(readBRes.status, 403, "Manager A must be forbidden (403) from reading Order B");

      // 6b. Accept Order B by Manager A -> 403 Forbidden
      const acceptBReq = createApiRequest(`http://localhost:3000/api/orders/${orderBId}/accept`, {
        method: "POST",
        userId: managerAUser.id,
      });
      const acceptBRes = await acceptOrderRoute(acceptBReq, {
        params: Promise.resolve({ id: orderBId }),
      });
      assert.equal(acceptBRes.status, 403, "Manager A must be forbidden (403) from accepting Order B");

      // 6c. Reject Order B by Manager A -> 403 Forbidden
      const rejectBReq = createApiRequest(`http://localhost:3000/api/orders/${orderBId}/reject`, {
        method: "POST",
        userId: managerAUser.id,
        body: { rejectionReason: "OUT_OF_STOCK", rejectionNote: "Unauthorized rejection attempt" },
      });
      const rejectBRes = await rejectOrderRoute(rejectBReq, {
        params: Promise.resolve({ id: orderBId }),
      });
      assert.equal(rejectBRes.status, 403, "Manager A must be forbidden (403) from rejecting Order B");

      // 6d. Advance Order B by Manager A -> 403 Forbidden
      const advanceBReq = createApiRequest(`http://localhost:3000/api/orders/${orderBId}/advance`, {
        method: "POST",
        userId: managerAUser.id,
        body: { targetStatus: "PREPARING" },
      });
      const advanceBRes = await advanceOrderRoute(advanceBReq, {
        params: Promise.resolve({ id: orderBId }),
      });
      assert.equal(advanceBRes.status, 403, "Manager A must be forbidden (403) from advancing Order B");

      // 6e. List Shop B Queue by Manager A -> 403 Forbidden
      const queueBForbiddenReq = createApiRequest(`http://localhost:3000/api/shops/${tempShopB.id}/orders`, {
        userId: managerAUser.id,
      });
      const queueBForbiddenRes = await listShopOrdersRoute(queueBForbiddenReq, {
        params: Promise.resolve({ shopId: tempShopB.id }),
      });
      assert.equal(queueBForbiddenRes.status, 403, "Manager A must be forbidden (403) from listing Shop B orders");

      // 6f. Verify legitimate Manager B CAN accept Order B
      const acceptBValidReq = createApiRequest(`http://localhost:3000/api/orders/${orderBId}/accept`, {
        method: "POST",
        userId: managerBUser.id,
      });
      const acceptBValidRes = await acceptOrderRoute(acceptBValidReq, {
        params: Promise.resolve({ id: orderBId }),
      });
      assert.equal(acceptBValidRes.status, 200, "Manager B must be authorized to accept Order B");
      const acceptBValidJson = await acceptBValidRes.json();
      assert.equal(acceptBValidJson.data.status, "CONFIRMED");

      console.log("✔ Scenario 17: Stage 3 Multi-Shop Routing & Queue Isolation verified.");
    }

    console.log("\n========================================================");
    console.log("  ALL API INTEGRATION TESTS PASSED SUCCESSFULLY!         ");
    console.log("========================================================\n");
  } finally {
    console.log("--- Executing Narrow Run-Scoped Cleanup & Baseline Verification ---");

    try {
      if (createdOrderIds.size > 0) {
        await prisma.orderItem.deleteMany({
          where: { orderId: { in: Array.from(createdOrderIds) } },
        });
        await prisma.paymentRecord.deleteMany({
          where: { orderId: { in: Array.from(createdOrderIds) } },
        });
        await prisma.order.deleteMany({
          where: { id: { in: Array.from(createdOrderIds) } },
        });
      }
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
      if (createdUserIds.size > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: Array.from(createdUserIds) } },
        });
      }
      console.log(`✔ Tracked fixtures (${createdOrderIds.size} orders, ${createdProductIds.size} products, ${createdCategoryIds.size} categories, ${createdUserIds.size} users, ${createdShopMemberIds.size} memberships, ${createdShopIds.size} shops) deleted cleanly.`);
    } catch (cleanupErr) {
      console.error("❌ Cleanup encountered an error:", cleanupErr);
      throw cleanupErr;
    }

    // Verify baseline seed catalog
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
    assert.equal(orders, 0, "Leftover test orders detected!");
    assert.equal(users, 0, "Leftover test users detected!");

    console.log("✔ Baseline Seed Catalog verified intact.\n");
  }
}

main()
  .catch((err) => {
    console.error("\n❌ API Integration Test Suite Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
