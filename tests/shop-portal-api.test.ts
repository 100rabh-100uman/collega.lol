/**
 * COLLEGA.LOL — Stage 6D: Shop Portal API Integration Tests (Phase 6D.1)
 *
 * Validates backend prerequisites for the Shop Portal:
 * 1. GET   /api/shops/memberships (Strict server-side authorized shop listing)
 * 2. PATCH /api/shops/[shopId]    (Shop pause/resume toggle with OWNER/MANAGER RBAC)
 * 3. Server-side concurrent order rejection when shop is paused (isOpen = false)
 * 4. Production-mode security: dev session switching & dev cookies completely rejected
 * 5. In-memory dev staff/manager sessions operate without creating fake database users
 */

import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

try {
  process.loadEnvFile?.(".env");
} catch {}

import { prisma } from "../src/core/db/prisma";
import {
  SEED_CAMPUS_ID,
  SEED_SHOP_ID,
  SEED_CATEGORY_HOT_MEALS_ID,
  SEED_PRODUCT_VEGGIE_WRAP_ID,
  SEED_PRODUCT_MASALA_FRIES_ID,
} from "../prisma/seed";

import { GET as getShopMembershipsRoute } from "../src/app/api/shops/memberships/route";
import { PATCH as patchShopRoute } from "../src/app/api/shops/[shopId]/route";
import { POST as createOrderRoute } from "../src/app/api/orders/route";
import { GET as listShopOrdersRoute } from "../src/app/api/shops/[shopId]/orders/route";
import { POST as acceptOrderRoute } from "../src/app/api/orders/[id]/accept/route";
import { POST as advanceOrderRoute } from "../src/app/api/orders/[id]/advance/route";
import {
  GET as getDevSessionRoute,
  POST as postDevSessionRoute,
  DELETE as deleteDevSessionRoute,
} from "../src/app/api/dev/session/route";
import {
  GET as getCategoriesRoute,
  POST as createCategoryRoute,
} from "../src/app/api/shops/[shopId]/categories/route";
import { PATCH as patchCategoryRoute } from "../src/app/api/shops/[shopId]/categories/[categoryId]/route";
import { POST as createProductRoute } from "../src/app/api/shops/[shopId]/products/route";
import { PATCH as patchProductRoute } from "../src/app/api/shops/[shopId]/products/[productId]/route";
import { POST as uploadImageRoute } from "../src/app/api/shops/[shopId]/upload/route";
import { GET as getShopMenuRoute } from "../src/app/api/shops/[shopId]/menu/route";
import { POST as createStaffInvitationRoute } from "../src/app/api/shops/[shopId]/staff/invitations/route";
import { GET as listStaffSessionsRoute } from "../src/app/api/shops/[shopId]/staff/sessions/route";
import { POST as revokeStaffSessionRoute } from "../src/app/api/shops/[shopId]/staff/sessions/[sessionId]/revoke/route";
import { POST as redeemStaffRoute } from "../src/app/api/staff/redeem/route";
import { GET as getStaffSessionRoute } from "../src/app/api/staff/session/route";
import { GET as getPublicShopsRoute } from "../src/app/api/shops/public/route";
import { GET as getPublicShopBySlugRoute } from "../src/app/api/shops/public/[slug]/route";
import {
  getCurrentSession,
  DEV_STAFF_ID,
  DEV_STUDENT_ID,
  DEV_MANAGER_ID,
} from "../src/core/auth/session";

function createApiRequest(
  url: string,
  options: {
    method?: string;
    userId?: string | null;
    cookie?: string | null;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Request {
  const reqHeaders = new Headers(options.headers || {});
  reqHeaders.set("Content-Type", "application/json");

  if (options.userId) {
    reqHeaders.set("x-collega-test-user-id", options.userId);
  }
  if (options.cookie) {
    reqHeaders.set("cookie", options.cookie);
  }

  const init: RequestInit = {
    method: options.method || "GET",
    headers: reqHeaders,
  };

  if (options.body && options.method && options.method !== "GET") {
    if (typeof FormData !== "undefined" && options.body instanceof FormData) {
      reqHeaders.delete("Content-Type");
      init.body = options.body;
    } else {
      init.body = JSON.stringify(options.body);
    }
  }

  return new Request(url, init);
}

async function main() {
  console.log("========================================================");
  console.log("  COLLEGA.LOL — Stage 6D Shop Portal API Tests (Phase 6D.1)");
  console.log("========================================================\n");

  const RUN_ID = `shop_portal_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const createdUserIds = new Set<string>();
  const createdShopMemberIds = new Set<string>();
  const createdShopIds = new Set<string>();
  const createdOrderIds = new Set<string>();
  const createdCategoryIds = new Set<string>();
  const createdProductIds = new Set<string>();
  const createdStaffInvitationIds = new Set<string>();
  const createdStaffSessionIds = new Set<string>();
  const createdCampusIds = new Set<string>();

  try {
    // Setup test users in PostgreSQL for tenant and role isolation testing
    const studentId = randomUUID();
    await prisma.user.create({
      data: {
        id: studentId,
        email: `student_${RUN_ID}@test.collega.internal`,
        campusId: SEED_CAMPUS_ID,
        role: "STUDENT",
        isActive: true,
      },
    });
    createdUserIds.add(studentId);

    const staffId = randomUUID();
    await prisma.user.create({
      data: {
        id: staffId,
        email: `staff_${RUN_ID}@test.collega.internal`,
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

    const managerId = randomUUID();
    await prisma.user.create({
      data: {
        id: managerId,
        email: `manager_${RUN_ID}@test.collega.internal`,
        campusId: SEED_CAMPUS_ID,
        role: "STUDENT",
        isActive: true,
      },
    });
    createdUserIds.add(managerId);

    const managerMemberId = randomUUID();
    await prisma.shopMember.create({
      data: {
        id: managerMemberId,
        shopId: SEED_SHOP_ID,
        userId: managerId,
        role: "MANAGER",
        isActive: true,
      },
    });
    createdShopMemberIds.add(managerMemberId);

    // Super Admin
    const superAdminId = randomUUID();
    await prisma.user.create({
      data: {
        id: superAdminId,
        email: `superadmin_${RUN_ID}@test.collega.internal`,
        campusId: null,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    createdUserIds.add(superAdminId);

    console.log("✔ Isolated test fixtures initialized cleanly.\n");

    // =========================================================================
    // Scenario 1: GET /api/shops/memberships Authorization & Listing
    // =========================================================================
    {
      // 1. Unauthenticated request rejected
      const unauthReq = createApiRequest("http://localhost:3000/api/shops/memberships");
      const unauthRes = await getShopMembershipsRoute(unauthReq);
      assert.equal(unauthRes.status, 401, "Unauthenticated request must return 401");

      // 2. Student with 0 memberships returns empty array []
      const studentReq = createApiRequest("http://localhost:3000/api/shops/memberships", {
        userId: studentId,
      });
      const studentRes = await getShopMembershipsRoute(studentReq);
      assert.equal(studentRes.status, 200);
      const studentJson = await studentRes.json();
      assert.equal(studentJson.success, true);
      assert.deepEqual(studentJson.data, [], "Student with no shop memberships must receive empty array");

      // 3. Staff user returns Quad Bistro with role STAFF
      const staffReq = createApiRequest("http://localhost:3000/api/shops/memberships", {
        userId: staffId,
      });
      const staffRes = await getShopMembershipsRoute(staffReq);
      assert.equal(staffRes.status, 200);
      const staffJson = await staffRes.json();
      assert.equal(staffJson.success, true);
      assert.equal(staffJson.data.length, 1);
      assert.equal(staffJson.data[0].id, SEED_SHOP_ID);
      assert.equal(staffJson.data[0].role, "STAFF");
      assert.equal(staffJson.data[0].name, "The Campus Quad Bistro");

      // 4. Manager user returns Quad Bistro with role MANAGER
      const mgrReq = createApiRequest("http://localhost:3000/api/shops/memberships", {
        userId: managerId,
      });
      const mgrRes = await getShopMembershipsRoute(mgrReq);
      assert.equal(mgrRes.status, 200);
      const mgrJson = await mgrRes.json();
      assert.equal(mgrJson.data[0].role, "MANAGER");

      // 5. Super Admin returns all campus shops with role OWNER
      const adminReq = createApiRequest("http://localhost:3000/api/shops/memberships", {
        userId: superAdminId,
      });
      const adminRes = await getShopMembershipsRoute(adminReq);
      assert.equal(adminRes.status, 200);
      const adminJson = await adminRes.json();
      assert.ok(adminJson.data.length >= 1);
      assert.equal(adminJson.data[0].role, "OWNER");

      console.log("✔ Scenario 1: GET /api/shops/memberships correctly isolates authorized shops and roles.");
    }

    // =========================================================================
    // Scenario 2: In-Memory Non-Production Dev Staff & Manager Sessions
    // =========================================================================
    {
      const DEV_STAFF_ID = "00000000-0000-4000-a000-000000000002";
      const DEV_MANAGER_ID = "00000000-0000-4000-a000-000000000003";

      // 1. In-memory dev staff resolves without touching DB users table
      const staffReq = createApiRequest("http://localhost:3000/api/shops/memberships", {
        userId: DEV_STAFF_ID,
      });
      const staffRes = await getShopMembershipsRoute(staffReq);
      assert.equal(staffRes.status, 200);
      const staffJson = await staffRes.json();
      assert.equal(staffJson.data.length, 1);
      assert.equal(staffJson.data[0].id, SEED_SHOP_ID);
      assert.equal(staffJson.data[0].role, "STAFF");

      // 2. In-memory dev manager resolves with role MANAGER
      const mgrReq = createApiRequest("http://localhost:3000/api/shops/memberships", {
        userId: DEV_MANAGER_ID,
      });
      const mgrRes = await getShopMembershipsRoute(mgrReq);
      assert.equal(mgrRes.status, 200);
      const mgrJson = await mgrRes.json();
      assert.equal(mgrJson.data[0].role, "MANAGER");

      // 3. POST /api/dev/session switches roles
      const postStaffReq = createApiRequest("http://localhost:3000/api/dev/session", {
        method: "POST",
        body: { role: "STAFF" },
      });
      const postStaffRes = await postDevSessionRoute(postStaffReq);
      assert.equal(postStaffRes.status, 200);
      const postStaffJson = await postStaffRes.json();
      assert.equal(postStaffJson.data.user.id, DEV_STAFF_ID);
      assert.equal(postStaffJson.data.user.devRole, "STAFF");

      console.log("✔ Scenario 2: Non-production in-memory staff and manager sessions operate without fake DB records.");
    }

    // =========================================================================
    // Scenario 3: PATCH /api/shops/[shopId] Pause/Resume Ordering (RBAC & Concurrency)
    // =========================================================================
    {
      // 1. Student receives HTTP 403 FORBIDDEN
      const studentReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}`, {
        method: "PATCH",
        userId: studentId,
        body: { isOpen: false },
      });
      const studentRes = await patchShopRoute(studentReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(studentRes.status, 403, "Student must receive 403 when trying to patch shop");

      // 2. STAFF role receives HTTP 403 FORBIDDEN (requires OWNER or MANAGER)
      const staffReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}`, {
        method: "PATCH",
        userId: staffId,
        body: { isOpen: false },
      });
      const staffRes = await patchShopRoute(staffReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(staffRes.status, 403, "STAFF role must not be permitted to toggle shop isOpen status");

      // 3. MANAGER role toggles shop to closed (isOpen: false)
      const mgrCloseReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}`, {
        method: "PATCH",
        userId: managerId,
        body: { isOpen: false },
      });
      const mgrCloseRes = await patchShopRoute(mgrCloseReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(mgrCloseRes.status, 200);
      const mgrCloseJson = await mgrCloseRes.json();
      assert.equal(mgrCloseJson.data.isOpen, false);

      // 4. While shop is closed: Order placement MUST be blocked with HTTP 409 SHOP_CLOSED
      const orderReq = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: studentId,
        body: {
          shopId: SEED_SHOP_ID,
          items: [{ productId: SEED_PRODUCT_VEGGIE_WRAP_ID, quantity: 1, expectedUnitPrice: "120.00" }],
        },
      });
      const orderRes = await createOrderRoute(orderReq);
      assert.equal(orderRes.status, 409, "Order placement on closed shop must return 409 Conflict");
      const orderJson = await orderRes.json();
      assert.equal(orderJson.error.code, "SHOP_CLOSED");

      // 5. MANAGER resumes shop (isOpen: true)
      const mgrOpenReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}`, {
        method: "PATCH",
        userId: managerId,
        body: { isOpen: true },
      });
      const mgrOpenRes = await patchShopRoute(mgrOpenReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(mgrOpenRes.status, 200);
      const mgrOpenJson = await mgrOpenRes.json();
      assert.equal(mgrOpenJson.data.isOpen, true);

      // 6. After resumption, order placement succeeds
      const orderReq2 = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: studentId,
        body: {
          shopId: SEED_SHOP_ID,
          items: [{ productId: SEED_PRODUCT_VEGGIE_WRAP_ID, quantity: 1, expectedUnitPrice: "120.00" }],
          idempotencyKey: `resumed_shop_${Date.now()}`,
        },
      });
      const orderRes2 = await createOrderRoute(orderReq2);
      assert.equal(orderRes2.status, 201, "Order placement must succeed once shop is resumed");
      const orderJson2 = await orderRes2.json();
      assert.ok(orderJson2.data.id);
      createdOrderIds.add(orderJson2.data.id);

      console.log("✔ Scenario 3: PATCH /api/shops/[shopId] enforces OWNER/MANAGER role and halts in-flight orders when closed.");
    }

    // =========================================================================
    // Scenario 4: Production Mode Guardrails
    // =========================================================================
    {
      const prevEnv = process.env.NODE_ENV;
      try {
        // Simulate production environment
        (process.env as Record<string, string>).NODE_ENV = "production";

        // 1. Dev session endpoints return HTTP 403 FORBIDDEN
        const devPostReq = createApiRequest("http://localhost:3000/api/dev/session", {
          method: "POST",
          body: { role: "STAFF" },
        });
        const devPostRes = await postDevSessionRoute(devPostReq);
        assert.equal(devPostRes.status, 403, "POST /api/dev/session must be blocked in production");

        const devGetReq = createApiRequest("http://localhost:3000/api/dev/session");
        const devGetRes = await getDevSessionRoute(devGetReq);
        assert.equal(devGetRes.status, 403, "GET /api/dev/session must be blocked in production");

        const devDelRes = await deleteDevSessionRoute();
        assert.equal(devDelRes.status, 403, "DELETE /api/dev/session must be blocked in production");

        // 2. getCurrentSession ignores dev headers and cookies in production
        const devHeaderReq = createApiRequest("http://localhost:3000/api/orders", {
          userId: "00000000-0000-4000-a000-000000000002",
          cookie: "collega_dev_user_id=00000000-0000-4000-a000-000000000002",
        });
        const prodSession = await getCurrentSession(devHeaderReq);
        assert.equal(prodSession, null, "getCurrentSession in production must completely ignore dev headers and cookies");
      } finally {
        (process.env as Record<string, string>).NODE_ENV = prevEnv;
      }

      console.log("✔ Scenario 4: Production-mode guardrails verified (dev session endpoints and cookies strictly blocked).");
    }

    // --------------------------------------------------------------------------
    // Scenario 5: Order Card Clarity & Fast Visual Pickup Handover
    // --------------------------------------------------------------------------
    {
      // 1. Create a multi-item order as student with special note
      const orderReq = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: DEV_STUDENT_ID,
        body: {
          shopId: SEED_SHOP_ID,
          items: [
            {
              productId: SEED_PRODUCT_VEGGIE_WRAP_ID,
              quantity: 2,
              expectedUnitPrice: "120.00",
              specialInstructions: "Extra crispy wrap",
            },
            {
              productId: SEED_PRODUCT_MASALA_FRIES_ID,
              quantity: 1,
              expectedUnitPrice: "90.00",
            },
          ],
          idempotencyKey: `clarity_test_${Date.now()}`,
        },
      });

      const orderRes = await createOrderRoute(orderReq);
      assert.equal(orderRes.status, 201, "Order placement must return 201 Created");
      const orderJson = await orderRes.json();
      assert.equal(orderJson.success, true);
      const placedOrder = orderJson.data;
      createdOrderIds.add(placedOrder.id);
      createdUserIds.add(DEV_STUDENT_ID);

      // 2. Fetch order queue as shop staff (GET /api/shops/[shopId]/orders)
      const queueReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/orders`,
        {
          userId: DEV_STAFF_ID,
        }
      );
      const queueRes = await listShopOrdersRoute(queueReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(queueRes.status, 200, "Queue fetch must succeed with 200 OK");
      const queueJson = await queueRes.json();
      assert.equal(queueJson.success, true);

      const targetQueueOrder = queueJson.data.find(
        (o: { id: string }) => o.id === placedOrder.id
      );
      assert.ok(targetQueueOrder, "Placed order must be present in shop order queue");

      // Verify item details, snapshots, quantities, and line totals for staff clarity
      assert.equal(targetQueueOrder.items.length, 2);
      const wrapItem = targetQueueOrder.items.find(
        (i: { productNameSnapshot?: string; productName?: string }) =>
          (i.productNameSnapshot || i.productName) === "Veggie Wrap"
      );
      const friesItem = targetQueueOrder.items.find(
        (i: { productNameSnapshot?: string; productName?: string }) =>
          (i.productNameSnapshot || i.productName) === "Masala Fries"
      );

      assert.ok(wrapItem, "Veggie Wrap must exist with name snapshot");
      assert.equal(wrapItem.quantity, 2, "Quantity must be 2");
      assert.equal(Number(wrapItem.unitPriceSnapshot ?? wrapItem.unitPrice), 120, "Unit price must be 120");
      assert.equal(Number(wrapItem.subtotal), 240, "Subtotal must be 240");
      assert.equal(wrapItem.specialInstructions, "Extra crispy wrap", "Note must be preserved");

      assert.ok(friesItem, "Masala Fries must exist with name snapshot");
      assert.equal(friesItem.quantity, 1, "Quantity must be 1");
      assert.equal(Number(friesItem.unitPriceSnapshot ?? friesItem.unitPrice), 90, "Unit price must be 90");
      assert.equal(Number(friesItem.subtotal), 90, "Subtotal must be 90");

      assert.equal(Number(targetQueueOrder.totalAmount), 330, "Total must be 330");

      // 3. Progress order: PLACED -> CONFIRMED -> PREPARING -> READY
      const acceptReq = createApiRequest(
        `http://localhost:3000/api/orders/${placedOrder.id}/accept`,
        {
          method: "POST",
          userId: DEV_STAFF_ID,
        }
      );
      const acceptRes = await acceptOrderRoute(acceptReq, {
        params: Promise.resolve({ id: placedOrder.id }),
      });
      assert.equal(acceptRes.status, 200, "Staff acceptance must succeed");

      const prepReq = createApiRequest(
        `http://localhost:3000/api/orders/${placedOrder.id}/advance`,
        {
          method: "POST",
          userId: DEV_STAFF_ID,
          body: { targetStatus: "PREPARING" },
        }
      );
      const prepRes = await advanceOrderRoute(prepReq, {
        params: Promise.resolve({ id: placedOrder.id }),
      });
      assert.equal(prepRes.status, 200, "Advance to PREPARING must succeed");

      const readyReq = createApiRequest(
        `http://localhost:3000/api/orders/${placedOrder.id}/advance`,
        {
          method: "POST",
          userId: DEV_STAFF_ID,
          body: { targetStatus: "READY" },
        }
      );
      const readyRes = await advanceOrderRoute(readyReq, {
        params: Promise.resolve({ id: placedOrder.id }),
      });
      assert.equal(readyRes.status, 200, "Advance to READY must succeed");

      // 4. Fast Visual Pickup Handover: Staff confirms handover by calling advance with targetStatus: PICKED_UP
      const handoverReq = createApiRequest(
        `http://localhost:3000/api/orders/${placedOrder.id}/advance`,
        {
          method: "POST",
          userId: DEV_STAFF_ID,
          body: {
            targetStatus: "PICKED_UP",
            pickupCode: placedOrder.orderNumber,
          },
        }
      );
      const handoverRes = await advanceOrderRoute(handoverReq, {
        params: Promise.resolve({ id: placedOrder.id }),
      });
      assert.equal(handoverRes.status, 200, "Handover confirmation must advance order to PICKED_UP");
      const handoverJson = await handoverRes.json();
      assert.equal(handoverJson.data.status, "PICKED_UP");

      // 5. Complete order: PICKED_UP -> COMPLETED
      const completeReq = createApiRequest(
        `http://localhost:3000/api/orders/${placedOrder.id}/advance`,
        {
          method: "POST",
          userId: DEV_STAFF_ID,
          body: { targetStatus: "COMPLETED" },
        }
      );
      const completeRes = await advanceOrderRoute(completeReq, {
        params: Promise.resolve({ id: placedOrder.id }),
      });
      assert.equal(completeRes.status, 200, "Advance to COMPLETED must succeed");

      console.log("✔ Scenario 5: Order Card Clarity & Fast Visual Pickup Handover verified.");
    }

    // =========================================================================
    // SCENARIO 6: Phase 6E: Manager Menu Management (RBAC & Tenant Isolation)
    // =========================================================================
    {
      console.log("\n--- Testing Scenario 6: Manager Menu Management (Categories, Products & Photos) ---");

      // 1. GET /api/shops/[shopId]/categories
      // Student receives 403 Forbidden
      const studentCatReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/categories`, {
        method: "GET",
        userId: studentId,
      });
      const studentCatRes = await getCategoriesRoute(studentCatReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(studentCatRes.status, 403, "Student must not be allowed to list manager categories");

      // STAFF receives 403 Forbidden
      const staffCatReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/categories`, {
        method: "GET",
        userId: staffId,
      });
      const staffCatRes = await getCategoriesRoute(staffCatReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(staffCatRes.status, 403, "STAFF must receive 403 when listing manager categories");

      // MANAGER receives 200 OK with list of categories
      const mgrCatReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/categories`, {
        method: "GET",
        userId: managerId,
      });
      const mgrCatRes = await getCategoriesRoute(mgrCatReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(mgrCatRes.status, 200, "MANAGER must be able to list categories");
      const mgrCatJson = await mgrCatRes.json();
      assert.equal(mgrCatJson.success, true);
      assert.equal(mgrCatJson.data.length, 3, "Seed shop should initially have 3 categories");

      // 2. POST /api/shops/[shopId]/categories
      // STAFF is blocked (403)
      const staffCreateCatReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/categories`, {
        method: "POST",
        userId: staffId,
        body: { name: "Snacks Special", slug: "snacks-special" },
      });
      const staffCreateCatRes = await createCategoryRoute(staffCreateCatReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(staffCreateCatRes.status, 403, "STAFF cannot create categories");

      // Invalid slug with spaces/symbols rejected with 400
      const invalidSlugReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/categories`, {
        method: "POST",
        userId: managerId,
        body: { name: "Chef Specials", slug: "chef specials with spaces" },
      });
      const invalidSlugRes = await createCategoryRoute(invalidSlugReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(invalidSlugRes.status, 400, "Invalid category slug must be rejected with 400");

      // Valid Category creation by MANAGER
      const newCategorySlug = `specials-${Date.now()}`;
      const validCreateCatReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/categories`, {
        method: "POST",
        userId: managerId,
        body: {
          name: "Chef Specials",
          slug: newCategorySlug,
          sortOrder: 10,
          isAvailable: true,
        },
      });
      const validCreateCatRes = await createCategoryRoute(validCreateCatReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(validCreateCatRes.status, 201, "MANAGER can create a new category");
      const createdCatJson = await validCreateCatRes.json();
      const newCatId = createdCatJson.data.id;
      createdCategoryIds.add(newCatId);
      assert.equal(createdCatJson.data.name, "Chef Specials");

      // Duplicate slug rejected with 409
      const dupSlugReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/categories`, {
        method: "POST",
        userId: managerId,
        body: {
          name: "Another Specials",
          slug: newCategorySlug,
        },
      });
      const dupSlugRes = await createCategoryRoute(dupSlugReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(dupSlugRes.status, 409, "Duplicate category slug in same shop must return 409 Conflict");

      // 3. PATCH /api/shops/[shopId]/categories/[categoryId]
      // STAFF is blocked (403)
      const staffPatchCatReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/categories/${newCatId}`,
        {
          method: "PATCH",
          userId: staffId,
          body: { name: "Staff Renamed Category" },
        }
      );
      const staffPatchCatRes = await patchCategoryRoute(staffPatchCatReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID, categoryId: newCatId }),
      });
      assert.equal(staffPatchCatRes.status, 403, "STAFF cannot update category");

      // MANAGER updates category name & availability
      const mgrPatchCatReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/categories/${newCatId}`,
        {
          method: "PATCH",
          userId: managerId,
          body: { name: "Chef Signature Delights", isAvailable: true },
        }
      );
      const mgrPatchCatRes = await patchCategoryRoute(mgrPatchCatReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID, categoryId: newCatId }),
      });
      assert.equal(mgrPatchCatRes.status, 200, "MANAGER can update category details");
      const patchedCatJson = await mgrPatchCatRes.json();
      assert.equal(patchedCatJson.data.name, "Chef Signature Delights");

      // 4. POST /api/shops/[shopId]/products
      // STAFF is blocked (403)
      const staffCreateProdReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/products`, {
        method: "POST",
        userId: staffId,
        body: {
          name: "Test Product",
          price: "120.00",
          categoryId: newCatId,
        },
      });
      const staffCreateProdRes = await createProductRoute(staffCreateProdReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(staffCreateProdRes.status, 403, "STAFF cannot create products");

      // Negative or invalid price rejected (400)
      const invalidPriceReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/products`, {
        method: "POST",
        userId: managerId,
        body: {
          name: "Invalid Price Item",
          price: "-25.00",
          categoryId: newCatId,
        },
      });
      const invalidPriceRes = await createProductRoute(invalidPriceReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(invalidPriceRes.status, 400, "Negative price must be rejected with 400");

      // Cross-shop category assignment rejected (404)
      const nonExistentCatReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/products`, {
        method: "POST",
        userId: managerId,
        body: {
          name: "Cross Shop Item",
          price: "150.00",
          categoryId: randomUUID(),
        },
      });
      const nonExistentCatRes = await createProductRoute(nonExistentCatReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(nonExistentCatRes.status, 404, "Foreign category must be rejected with 404");

      // MANAGER creates product
      const validCreateProdReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/products`, {
        method: "POST",
        userId: managerId,
        body: {
          name: "Truffle Cheese Fries",
          description: "Crispy fries with real truffle parmesan",
          price: "185.00",
          categoryId: newCatId,
          preparationTimeMins: 10,
          isAvailable: true,
          sortOrder: 1,
        },
      });
      const validCreateProdRes = await createProductRoute(validCreateProdReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(validCreateProdRes.status, 201, "MANAGER can create product");
      const createdProdJson = await validCreateProdRes.json();
      const newProdId = createdProdJson.data.id;
      createdProductIds.add(newProdId);
      assert.equal(createdProdJson.data.name, "Truffle Cheese Fries");

      // 5. Verify student catalog reflection for newly created product
      const studentMenuReq1 = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/menu`, {
        method: "GET",
        userId: studentId,
      });
      const studentMenuRes1 = await getShopMenuRoute(studentMenuReq1, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(studentMenuRes1.status, 200);
      const studentMenuJson1 = await studentMenuRes1.json();
      const reflectedCat1 = studentMenuJson1.data.categories.find(
        (c: { id: string; products: Array<{ id: string; name: string }> }) => c.id === newCatId
      );
      assert.ok(reflectedCat1, "New category must appear in student menu catalog");
      const reflectedProd1 = reflectedCat1.products.find(
        (p: { id: string; name: string }) => p.id === newProdId
      );
      assert.ok(reflectedProd1, "New available product must appear under category in student menu catalog");
      assert.equal(reflectedProd1.name, "Truffle Cheese Fries");

      // 6. PATCH /api/shops/[shopId]/products/[productId]
      // STAFF is blocked (403)
      const staffPatchProdReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/products/${newProdId}`,
        {
          method: "PATCH",
          userId: staffId,
          body: { price: "200.00" },
        }
      );
      const staffPatchProdRes = await patchProductRoute(staffPatchProdReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID, productId: newProdId }),
      });
      assert.equal(staffPatchProdRes.status, 403, "STAFF cannot update products");

      // MANAGER updates price to 199.00 and toggles isAvailable to false
      const mgrPatchProdReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/products/${newProdId}`,
        {
          method: "PATCH",
          userId: managerId,
          body: {
            price: "199.00",
            isAvailable: false,
          },
        }
      );
      const mgrPatchProdRes = await patchProductRoute(mgrPatchProdReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID, productId: newProdId }),
      });
      assert.equal(mgrPatchProdRes.status, 200, "MANAGER can update product details and price");
      const patchedProdJson = await mgrPatchProdRes.json();
      assert.equal(patchedProdJson.data.isAvailable, false);

      // Verify that unavailable product remains visible in student menu catalog with isAvailable: false (Phase 6F)
      const studentMenuReq2 = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/menu`, {
        method: "GET",
        userId: studentId,
      });
      const studentMenuRes2 = await getShopMenuRoute(studentMenuReq2, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      const studentMenuJson2 = await studentMenuRes2.json();
      const reflectedCat2 = studentMenuJson2.data.categories.find(
        (c: { id: string; products: Array<{ id: string; name: string }> }) => c.id === newCatId
      );
      const oosProd = reflectedCat2?.products.find(
        (p: { id: string; name: string; isAvailable: boolean }) => p.id === newProdId
      );
      assert.ok(oosProd, "Unavailable product must remain visible in student menu catalog (Phase 6F)");
      assert.equal(oosProd.isAvailable, false, "Unavailable product must report isAvailable: false");

      // 7. Test Image Upload RBAC & Validation
      // STAFF is blocked (403)
      const mockFormData = new FormData();
      const mockPngBlob = new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64")], { type: "image/png" });
      mockFormData.append("file", mockPngBlob, "test.png");

      const staffUploadReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/upload`, {
        method: "POST",
        userId: staffId,
        body: mockFormData,
      });
      const staffUploadRes = await uploadImageRoute(staffUploadReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(staffUploadRes.status, 403, "STAFF cannot upload product images");

      // MANAGER upload with valid image succeeds (201)
      const mgrUploadReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/upload`, {
        method: "POST",
        userId: managerId,
        body: mockFormData,
      });
      const mgrUploadRes = await uploadImageRoute(mgrUploadReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(mgrUploadRes.status, 201, "MANAGER can upload product image");
      const mgrUploadJson = await mgrUploadRes.json();
      assert.equal(mgrUploadJson.success, true);
      assert.ok(mgrUploadJson.data.url.includes("product-images"), "Public URL from Supabase Storage must be returned");

      console.log("✔ Scenario 6: Phase 6E Manager Menu Management verified.");
    }

    // ========================================================
    // Scenario 7: Phase 6F Student Catalog Fixes & Secure Mobile Staff Access
    // ========================================================
    {
      console.log("\n--- Scenario 7: Phase 6F Student Catalog Fixes & Secure Mobile Staff Access ---");

      // 7.1 Out-of-Stock Behavior: Unavailable items visible in catalog with isAvailable: false
      const unavailProduct = await prisma.product.create({
        data: {
          shopId: SEED_SHOP_ID,
          categoryId: SEED_CATEGORY_HOT_MEALS_ID,
          name: `OOS Product ${RUN_ID}`,
          price: "180",
          isAvailable: false,
          sortOrder: 99,
        },
      });
      createdProductIds.add(unavailProduct.id);

      // Student calls menu endpoint: unavailable item must be returned!
      const studentMenuReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/menu`,
        { userId: studentId }
      );
      const studentMenuRes = await getShopMenuRoute(studentMenuReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(studentMenuRes.status, 200, "Student menu fetch must succeed");
      const studentMenuJson = await studentMenuRes.json();
      const allMenuProducts = (
        studentMenuJson.data.categories as Array<{
          products: Array<{ id: string; isAvailable: boolean }>;
        }>
      ).flatMap((c) => c.products);
      const returnedOOS = allMenuProducts.find((p) => p.id === unavailProduct.id);
      assert.ok(returnedOOS, "Out of stock product must be visible in student menu");
      assert.equal(returnedOOS.isAvailable, false, "Out of stock product must report isAvailable: false");

      // Student attempts to order out-of-stock item: server must reject with 409 Conflict!
      const oosOrderReq = createApiRequest("http://localhost:3000/api/orders", {
        method: "POST",
        userId: studentId,
        body: {
          shopId: SEED_SHOP_ID,
          items: [
            {
              productId: unavailProduct.id,
              quantity: 1,
              expectedUnitPrice: "180",
            },
          ],
        },
      });
      const oosOrderRes = await createOrderRoute(oosOrderReq);
      assert.equal(oosOrderRes.status, 409, "Server must reject ordering unavailable product with 409 Conflict");
      const oosOrderJson = await oosOrderRes.json();
      assert.equal(oosOrderJson.error.code, "PRODUCT_UNAVAILABLE");

      // 7.2 Staff Invitation Security: Student & Staff blocked from generating invitations
      const studentInvReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/staff/invitations`,
        { method: "POST", userId: studentId, body: { expiryMinutes: 15 } }
      );
      const studentInvRes = await createStaffInvitationRoute(studentInvReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(studentInvRes.status, 403, "Students cannot generate staff invitations");

      const staffInvReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/staff/invitations`,
        { method: "POST", userId: staffId, body: { expiryMinutes: 15 } }
      );
      const staffInvRes = await createStaffInvitationRoute(staffInvReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(staffInvRes.status, 403, "Staff cannot generate staff invitations");

      // Manager generates valid invitation
      const mgrInvReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/staff/invitations`,
        { method: "POST", userId: managerId, body: { expiryMinutes: 15 } }
      );
      const mgrInvRes = await createStaffInvitationRoute(mgrInvReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(mgrInvRes.status, 201, "Manager can generate staff invitation");
      const mgrInvJson = await mgrInvRes.json();
      assert.equal(mgrInvJson.success, true);
      const { id: inv1Id, invitationToken: inv1Token, code: inv1Code } = mgrInvJson.data;
      createdStaffInvitationIds.add(inv1Id);

      assert.ok(inv1Token && inv1Token.length >= 32, "Invitation token must be unguessable hex");
      assert.match(inv1Code, /^\d{10}$/, "Code must be a 10-digit numeric PIN");

      // Verify DB stores hashes, not raw secrets
      const dbInv1 = await prisma.staffInvitation.findUnique({ where: { id: inv1Id } });
      assert.notEqual(dbInv1?.tokenHash, inv1Token, "Raw token must never be stored in database");
      assert.notEqual(dbInv1?.codeHash, inv1Code, "Raw code must never be stored in database");

      // 7.3 Active Staff Counter: Initial count is 0
      const listSessionsReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/staff/sessions`,
        { userId: managerId }
      );
      const listSessionsRes = await listStaffSessionsRoute(listSessionsReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(listSessionsRes.status, 200);
      const listSessionsJson = await listSessionsRes.json();
      assert.equal(listSessionsJson.data.activeStaffCount, 0, "Initial active staff count must be 0");
      assert.equal(listSessionsJson.data.pendingInvitations.length, 1, "Pending invitation must be listed");

      // 7.4 Rate Limiting & PIN Brute-force Protection (max 5 failed attempts auto-revokes)
      for (let attempt = 1; attempt <= 4; attempt++) {
        const failReq = createApiRequest("http://localhost:3000/api/staff/redeem", {
          method: "POST",
          body: { token: inv1Token, code: "0000000000" },
        });
        const failRes = await redeemStaffRoute(failReq);
        assert.equal(failRes.status, 400, "Wrong PIN must return 400 validation error");
        const failJson = await failRes.json();
        assert.ok(failJson.error.message.includes(`${5 - attempt} attempt`), "Remaining attempts must be tracked");
      }

      // 5th attempt triggers revocation
      const finalFailReq = createApiRequest("http://localhost:3000/api/staff/redeem", {
        method: "POST",
        body: { token: inv1Token, code: "0000000000" },
      });
      const finalFailRes = await redeemStaffRoute(finalFailReq);
      assert.equal(finalFailRes.status, 400);
      const finalFailJson = await finalFailRes.json();
      assert.ok(finalFailJson.error.message.includes("revoked"), "5th failed attempt must revoke invitation");

      // Redeeming revoked invitation even with correct code now fails
      const postRevokeReq = createApiRequest("http://localhost:3000/api/staff/redeem", {
        method: "POST",
        body: { token: inv1Token, code: inv1Code },
      });
      const postRevokeRes = await redeemStaffRoute(postRevokeReq);
      assert.equal(postRevokeRes.status, 400, "Revoked invitation cannot be redeemed");

      // 7.5 Successful Staff Redemption & Connected Staff Counter increment
      const mgrInv2Req = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/staff/invitations`,
        { method: "POST", userId: managerId, body: { expiryMinutes: 15 } }
      );
      const mgrInv2Res = await createStaffInvitationRoute(mgrInv2Req, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      const mgrInv2Json = await mgrInv2Res.json();
      const { id: inv2Id, invitationToken: inv2Token, code: inv2Code } = mgrInv2Json.data;
      createdStaffInvitationIds.add(inv2Id);

      const redeemReq = createApiRequest("http://localhost:3000/api/staff/redeem", {
        method: "POST",
        body: { token: inv2Token, code: inv2Code },
      });
      const redeemRes = await redeemStaffRoute(redeemReq);
      assert.equal(redeemRes.status, 201, "Valid redemption must succeed with 201");
      const redeemJson = await redeemRes.json();
      const { sessionToken, sessionId, staffLabel } = redeemJson.data;
      createdStaffSessionIds.add(sessionId);
      assert.ok(sessionToken && sessionToken.length >= 32, "Must return secure session token");
      assert.equal(staffLabel, "Counter Staff #1");

      // Single-use guarantee: Re-redeeming fails
      const replayRedeemReq = createApiRequest("http://localhost:3000/api/staff/redeem", {
        method: "POST",
        body: { token: inv2Token, code: inv2Code },
      });
      const replayRedeemRes = await redeemStaffRoute(replayRedeemReq);
      assert.equal(replayRedeemRes.status, 400, "Single-use invitation cannot be redeemed twice");

      // Manager checks active staff count: now 1!
      const listSessions2Req = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/staff/sessions`,
        { userId: managerId }
      );
      const listSessions2Res = await listStaffSessionsRoute(listSessions2Req, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      const listSessions2Json = await listSessions2Res.json();
      assert.equal(listSessions2Json.data.activeStaffCount, 1, "Active staff count must increment to 1");
      assert.equal(listSessions2Json.data.sessions[0].id, sessionId);

      // 7.6 Staff Token Authorization: Order Queue access allowed, Manager capabilities strictly blocked
      // Queue access allowed
      const staffQueueReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/orders`,
        { headers: { "x-collega-staff-token": sessionToken } }
      );
      const staffQueueRes = await listShopOrdersRoute(staffQueueReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(staffQueueRes.status, 200, "Staff token must access shop order queue");

      // Manager routes blocked with 403:
      // Category creation blocked
      const staffCatReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/categories`,
        {
          method: "POST",
          headers: { "x-collega-staff-token": sessionToken },
          body: { name: "Illegal Staff Category" },
        }
      );
      const staffCatRes = await createCategoryRoute(staffCatReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(staffCatRes.status, 403, "Staff token cannot manage categories");

      // Product creation blocked
      const staffProdReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/products`,
        {
          method: "POST",
          headers: { "x-collega-staff-token": sessionToken },
          body: {
            categoryId: SEED_CATEGORY_HOT_MEALS_ID,
            name: "Illegal Staff Product",
            price: "100",
          },
        }
      );
      const staffProdRes = await createProductRoute(staffProdReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(staffProdRes.status, 403, "Staff token cannot create products");

      // Shop pause/resume blocked
      const staffPauseReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}`,
        {
          method: "PATCH",
          headers: { "x-collega-staff-token": sessionToken },
          body: { isOpen: false },
        }
      );
      const staffPauseRes = await patchShopRoute(staffPauseReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(staffPauseRes.status, 403, "Staff token cannot pause/resume shop");

      // 7.7 Cross-Shop Isolation: Staff cannot access orders of another shop
      const shopB = await prisma.shop.create({
        data: {
          campusId: SEED_CAMPUS_ID,
          name: `Cross-Shop B ${RUN_ID}`,
          slug: `cross-shop-b-${RUN_ID}`,
          location: "Student Center Annex",
          isOpen: true,
          autoAcceptOrders: false,
        },
      });
      createdShopIds.add(shopB.id);

      const crossShopReq = createApiRequest(
        `http://localhost:3000/api/shops/${shopB.id}/orders`,
        { headers: { "x-collega-staff-token": sessionToken } }
      );
      const crossShopRes = await listShopOrdersRoute(crossShopReq, {
        params: Promise.resolve({ shopId: shopB.id }),
      });
      assert.equal(crossShopRes.status, 403, "Staff cannot access orders for another shop");

      // Cross-shop manager listing/revocation blocked
      const crossMgrReq = createApiRequest(
        `http://localhost:3000/api/shops/${shopB.id}/staff/sessions`,
        { userId: managerId }
      );
      const crossMgrRes = await listStaffSessionsRoute(crossMgrReq, {
        params: Promise.resolve({ shopId: shopB.id }),
      });
      assert.equal(crossMgrRes.status, 403, "Manager cannot view staff sessions of another shop");

      // 7.8 Immediate Session Revocation by Manager
      const revokeReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/staff/sessions/${sessionId}/revoke`,
        { method: "POST", userId: managerId }
      );
      const revokeRes = await revokeStaffSessionRoute(revokeReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID, sessionId }),
      });
      assert.equal(revokeRes.status, 200, "Manager can revoke staff session");

      // Manager active staff count decrements back to 0
      const listSessions3Req = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/staff/sessions`,
        { userId: managerId }
      );
      const listSessions3Res = await listStaffSessionsRoute(listSessions3Req, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      const listSessions3Json = await listSessions3Res.json();
      assert.equal(listSessions3Json.data.activeStaffCount, 0, "Active staff count must decrement to 0 after revocation");

      // Subsequent staff API request with revoked token immediately fails (401)
      const postRevokeQueueReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/orders`,
        { headers: { "x-collega-staff-token": sessionToken } }
      );
      const postRevokeQueueRes = await listShopOrdersRoute(postRevokeQueueReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(postRevokeQueueRes.status, 401, "Subsequent staff request must fail with 401 after revocation");

      // Staff session heartbeat check reports active: false (triggers access revoked screen on mobile)
      const heartbeatReq = createApiRequest("http://localhost:3000/api/staff/session", {
        headers: { "x-collega-staff-token": sessionToken },
      });
      const heartbeatRes = await getStaffSessionRoute(heartbeatReq);
      const heartbeatJson = await heartbeatRes.json();
      assert.equal(heartbeatJson.data.active, false, "Revoked session must report active: false in heartbeat check");

      console.log("✔ Scenario 7: Phase 6F Student Catalog Fixes & Secure Mobile Staff Access verified.");
    }

    // =========================================================================
    // Scenario 8: Phase 6F.1 Manager Access Recovery & Staff Role Separation
    // =========================================================================
    {
      console.log("\n--- Testing Scenario 8: Phase 6F.1 Manager Access Recovery & Staff Role Separation ---");

      // 8.1 Authenticated Manager Entry: /api/shops/memberships returns MANAGER role
      const managerEntryReq = createApiRequest("http://localhost:3000/api/shops/memberships", {
        userId: DEV_MANAGER_ID,
      });
      const managerEntryRes = await getShopMembershipsRoute(managerEntryReq);
      assert.equal(managerEntryRes.status, 200, "Manager membership request must succeed");
      const managerEntryJson = await managerEntryRes.json();
      assert.ok(Array.isArray(managerEntryJson.data), "Memberships must return array");
      const seedShopManager = managerEntryJson.data.find((s: { id: string }) => s.id === SEED_SHOP_ID);
      assert.ok(seedShopManager, "Seed shop must be in manager memberships");
      assert.equal(seedShopManager.role, "MANAGER", "Manager membership must report role: 'MANAGER'");

      // 8.2 Generate fresh Staff Invitation and redeem to get real staff token
      const staffInviteReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/staff/invitations`,
        {
          method: "POST",
          userId: DEV_MANAGER_ID,
          body: { expiryMinutes: 15 },
        }
      );
      const staffInviteRes = await createStaffInvitationRoute(staffInviteReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(staffInviteRes.status, 201);
      const staffInviteJson = await staffInviteRes.json();
      createdStaffInvitationIds.add(staffInviteJson.data.id);

      const redeemReq = createApiRequest("http://localhost:3000/api/staff/redeem", {
        method: "POST",
        body: {
          token: staffInviteJson.data.invitationToken,
          code: staffInviteJson.data.code,
        },
      });
      const redeemRes = await redeemStaffRoute(redeemReq);
      assert.equal(redeemRes.status, 201);
      const redeemJson = await redeemRes.json();
      const testStaffToken = redeemJson.data.sessionToken;
      createdStaffSessionIds.add(redeemJson.data.sessionId);

      // 8.3 Staff Session Role Separation: /api/shops/memberships returns STAFF role
      const staffEntryReq = createApiRequest("http://localhost:3000/api/shops/memberships", {
        headers: { "x-collega-staff-token": testStaffToken },
      });
      const staffEntryRes = await getShopMembershipsRoute(staffEntryReq);
      assert.equal(staffEntryRes.status, 200);
      const staffEntryJson = await staffEntryRes.json();
      const seedShopStaff = staffEntryJson.data.find((s: { id: string }) => s.id === SEED_SHOP_ID);
      assert.ok(seedShopStaff, "Seed shop must be in staff memberships");
      assert.equal(seedShopStaff.role, "STAFF", "Staff session must strictly report role: 'STAFF'");

      // 8.4 Staff Restriction: Prohibited from manager dashboard and staff management APIs
      const staffGenInviteReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/staff/invitations`,
        {
          method: "POST",
          headers: { "x-collega-staff-token": testStaffToken },
          body: { expiryMinutes: 15 },
        }
      );
      const staffGenInviteRes = await createStaffInvitationRoute(staffGenInviteReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(staffGenInviteRes.status, 403, "Staff token must be forbidden from generating staff invitations");

      const staffListSessionsReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/staff/sessions`,
        {
          headers: { "x-collega-staff-token": testStaffToken },
        }
      );
      const staffListSessionsRes = await listStaffSessionsRoute(staffListSessionsReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(staffListSessionsRes.status, 403, "Staff token must be forbidden from listing active staff sessions");

      // 8.5 Staff Restriction: Prohibited from menu management
      const staffAddCatReq = createApiRequest(
        `http://localhost:3000/api/shops/${SEED_SHOP_ID}/categories`,
        {
          method: "POST",
          headers: { "x-collega-staff-token": testStaffToken },
          body: { name: "Illegal Category", displayOrder: 1 },
        }
      );
      const staffAddCatRes = await createCategoryRoute(staffAddCatReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(staffAddCatRes.status, 403, "Staff token must be forbidden from creating menu categories");

      // 8.6 Manager Session Precedence: Authenticated Manager identity is never shadowed by staff cookie
      const managerPrecedenceReq = createApiRequest("http://localhost:3000/api/shops/memberships", {
        userId: DEV_MANAGER_ID,
        cookie: `collega_staff_token=${testStaffToken}`,
      });
      const managerPrecedenceRes = await getShopMembershipsRoute(managerPrecedenceReq);
      assert.equal(managerPrecedenceRes.status, 200);
      const managerPrecedenceJson = await managerPrecedenceRes.json();
      const precedenceShop = managerPrecedenceJson.data.find((s: { id: string }) => s.id === SEED_SHOP_ID);
      assert.ok(precedenceShop);
      assert.equal(precedenceShop.role, "MANAGER", "Manager identity must take precedence over staff cookie");

      console.log("✔ Scenario 8: Phase 6F.1 Manager Access Recovery & Staff Role Separation verified.");
    }

    // =========================================================================
    // Scenario 9: Phase 6F.2 Public Shop Directory & Slug Routing
    // =========================================================================
    {
      console.log("\n--- Testing Scenario 9: Phase 6F.2 Public Shop Directory & Slug Routing ---");

      // 9.1 Public Shop Directory Listing (Unauthenticated, no roles exposed)
      const pubReq = createApiRequest("http://localhost:3000/api/shops/public");
      const pubRes = await getPublicShopsRoute(pubReq);
      assert.equal(pubRes.status, 200, "Public shops directory must return 200 without authentication");
      const pubJson = await pubRes.json();
      assert.equal(pubJson.success, true);
      assert.ok(Array.isArray(pubJson.data), "Public shops must return an array");

      const seedShopPublic = pubJson.data.find((s: { id: string }) => s.id === SEED_SHOP_ID);
      assert.ok(seedShopPublic, "Seed shop must be listed in public directory");
      assert.equal(seedShopPublic.name, "The Campus Quad Bistro");
      assert.equal(seedShopPublic.slug, "quad-bistro");
      assert.equal(typeof seedShopPublic.isOpen, "boolean");

      // Verify that internal roles, tokens, and memberships are strictly omitted from public cards
      assert.equal(seedShopPublic.role, undefined, "Public shop card must not expose internal user roles");
      assert.equal(seedShopPublic.memberships, undefined, "Public shop card must not expose memberships");
      assert.equal(seedShopPublic.token, undefined, "Public shop card must not expose tokens");

      // 9.2 Dynamic Multi-Shop Discovery: Directory reflects all shops in the campus dynamically
      const ephemeralShop = await prisma.shop.create({
        data: {
          campusId: SEED_CAMPUS_ID,
          name: `North Annex Cafe ${RUN_ID}`,
          slug: `north-annex-cafe-${RUN_ID}`,
          location: "Library Concourse",
          isOpen: true,
          autoAcceptOrders: true,
        },
      });
      createdShopIds.add(ephemeralShop.id);

      const pubReqMulti = createApiRequest("http://localhost:3000/api/shops/public");
      const pubResMulti = await getPublicShopsRoute(pubReqMulti);
      const pubJsonMulti = await pubResMulti.json();

      const foundSeed = pubJsonMulti.data.find((s: { id: string }) => s.id === SEED_SHOP_ID);
      const foundEphemeral = pubJsonMulti.data.find((s: { id: string }) => s.id === ephemeralShop.id);

      assert.ok(foundSeed, "Seed shop must be present in multi-shop directory");
      assert.ok(foundEphemeral, "Dynamically created campus shop must appear in public directory");
      assert.equal(foundEphemeral.name, `North Annex Cafe ${RUN_ID}`);
      assert.equal(foundEphemeral.location, "Library Concourse");

      // 9.3 Public Shop Detail & Slug Resolution (/api/shops/public/[slug])
      const slugReq1 = createApiRequest(`http://localhost:3000/api/shops/public/quad-bistro`);
      const slugRes1 = await getPublicShopBySlugRoute(slugReq1, {
        params: Promise.resolve({ slug: "quad-bistro" }),
      });
      assert.equal(slugRes1.status, 200, "Resolving shop by slug must succeed");
      const slugJson1 = await slugRes1.json();
      assert.equal(slugJson1.data.slug, "quad-bistro");
      assert.equal(slugJson1.data.name, "The Campus Quad Bistro");

      const slugReq2 = createApiRequest(`http://localhost:3000/api/shops/public/${ephemeralShop.slug}`);
      const slugRes2 = await getPublicShopBySlugRoute(slugReq2, {
        params: Promise.resolve({ slug: ephemeralShop.slug }),
      });
      assert.equal(slugRes2.status, 200);
      const slugJson2 = await slugRes2.json();
      assert.equal(slugJson2.data.name, `North Annex Cafe ${RUN_ID}`);

      // Invalid slug returns 404
      const invalidSlugReq = createApiRequest("http://localhost:3000/api/shops/public/non-existent-slug-xyz");
      const invalidSlugRes = await getPublicShopBySlugRoute(invalidSlugReq, {
        params: Promise.resolve({ slug: "non-existent-slug-xyz" }),
      });
      assert.equal(invalidSlugRes.status, 404, "Invalid slug must return 404 NotFound");

      // 9.4 Protected Workspaces Remain Strictly Guarded
      const unauthMembershipsReq = createApiRequest("http://localhost:3000/api/shops/memberships");
      const unauthMembershipsRes = await getShopMembershipsRoute(unauthMembershipsReq);
      assert.equal(unauthMembershipsRes.status, 401, "Shop memberships API must remain protected (401)");

      const unauthOrdersReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/orders`);
      const unauthOrdersRes = await listShopOrdersRoute(unauthOrdersReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(unauthOrdersRes.status, 401, "Shop orders fulfillment queue must remain protected (401)");

      console.log("✔ Scenario 9: Phase 6F.2 Public Shop Directory & Slug Routing verified.");
    }

    // =========================================================================
    // Scenario 10: Stage 2 Development Manager Multi-Shop Access & Isolation
    // =========================================================================
    {
      console.log("\n--- Testing Scenario 10: Stage 2 Development Manager Multi-Shop Access & Isolation ---");

      // 1. Create a second shop in the development campus (SEED_CAMPUS_ID)
      const shopB = await prisma.shop.create({
        data: {
          campusId: SEED_CAMPUS_ID,
          name: `Campus Bakery ${RUN_ID}`,
          slug: `campus-bakery-${RUN_ID}`,
          location: "Student Center Level 1",
          isOpen: true,
          autoAcceptOrders: true,
        },
      });
      createdShopIds.add(shopB.id);

      // 2. Create an isolated outside campus and a shop belonging to it
      const outsideCampus = await prisma.campus.create({
        data: {
          name: `South Satellite Campus ${RUN_ID}`,
          slug: `south-campus-${RUN_ID}`,
        },
      });
      createdCampusIds.add(outsideCampus.id);

      const shopOutside = await prisma.shop.create({
        data: {
          campusId: outsideCampus.id,
          name: `South Diner ${RUN_ID}`,
          slug: `south-diner-${RUN_ID}`,
          location: "Main Quad",
          isOpen: true,
          autoAcceptOrders: true,
        },
      });
      createdShopIds.add(shopOutside.id);

      // 3. Create a normal manager user explicitly assigned ONLY to Shop A (SEED_SHOP_ID)
      const normalManagerId = randomUUID();
      const normalManagerUser = await prisma.user.create({
        data: {
          id: normalManagerId,
          email: `normal-manager-${RUN_ID}@collega.test`,
          role: "STUDENT",
          campusId: SEED_CAMPUS_ID,
          isActive: true,
        },
      });
      createdUserIds.add(normalManagerUser.id);

      const normalMember = await prisma.shopMember.create({
        data: {
          userId: normalManagerUser.id,
          shopId: SEED_SHOP_ID,
          role: "MANAGER",
          isActive: true,
        },
      });
      createdShopMemberIds.add(normalMember.id);

      // --- VERIFICATION 1: Development Manager can access two shops in the same development campus ---
      // 1a. GET /api/shops/memberships returns both shops in the development campus with role MANAGER
      const devMgrMembershipsReq = createApiRequest("http://localhost:3000/api/shops/memberships", {
        userId: DEV_MANAGER_ID,
      });
      const devMgrMembershipsRes = await getShopMembershipsRoute(devMgrMembershipsReq);
      assert.equal(devMgrMembershipsRes.status, 200);
      const devMgrMembershipsJson = await devMgrMembershipsRes.json();
      assert.ok(devMgrMembershipsJson.success);
      const memberShopIds = devMgrMembershipsJson.data.map((s: { id: string }) => s.id);
      assert.ok(memberShopIds.includes(SEED_SHOP_ID), "Dev manager must have access to Seed Shop A");
      assert.ok(memberShopIds.includes(shopB.id), "Dev manager must have access to Shop B in the same dev campus");
      const shopBMember = devMgrMembershipsJson.data.find((s: { id: string }) => s.id === shopB.id);
      assert.equal(shopBMember.role, "MANAGER", "Dev manager role for Shop B must be MANAGER");

      // 1b. Dev manager can view orders for Shop B
      const devMgrShopBOrdersReq = createApiRequest(`http://localhost:3000/api/shops/${shopB.id}/orders`, {
        userId: DEV_MANAGER_ID,
      });
      const devMgrShopBOrdersRes = await listShopOrdersRoute(devMgrShopBOrdersReq, {
        params: Promise.resolve({ shopId: shopB.id }),
      });
      assert.equal(devMgrShopBOrdersRes.status, 200, "Dev manager must be able to view Shop B orders");

      // 1c. Dev manager can toggle Shop B status (PATCH /api/shops/[shopId])
      const devMgrToggleReq = createApiRequest(`http://localhost:3000/api/shops/${shopB.id}`, {
        method: "PATCH",
        userId: DEV_MANAGER_ID,
        body: { isOpen: false },
      });
      const devMgrToggleRes = await patchShopRoute(devMgrToggleReq, {
        params: Promise.resolve({ shopId: shopB.id }),
      });
      assert.equal(devMgrToggleRes.status, 200, "Dev manager must be able to manage/toggle Shop B");
      const devMgrToggleJson = await devMgrToggleRes.json();
      assert.equal(devMgrToggleJson.data.isOpen, false);

      // --- VERIFICATION 2: Development Manager CANNOT access a shop outside the development campus ---
      // 2a. Dev manager cannot view orders of shopOutside (returns HTTP 403 Forbidden)
      const devMgrOutsideOrdersReq = createApiRequest(`http://localhost:3000/api/shops/${shopOutside.id}/orders`, {
        userId: DEV_MANAGER_ID,
      });
      const devMgrOutsideOrdersRes = await listShopOrdersRoute(devMgrOutsideOrdersReq, {
        params: Promise.resolve({ shopId: shopOutside.id }),
      });
      assert.equal(devMgrOutsideOrdersRes.status, 403, "Dev manager must be denied access (403) to shop outside dev campus");

      // 2b. Dev manager cannot toggle status of shopOutside
      const devMgrOutsideToggleReq = createApiRequest(`http://localhost:3000/api/shops/${shopOutside.id}`, {
        method: "PATCH",
        userId: DEV_MANAGER_ID,
        body: { isOpen: false },
      });
      const devMgrOutsideToggleRes = await patchShopRoute(devMgrOutsideToggleReq, {
        params: Promise.resolve({ shopId: shopOutside.id }),
      });
      assert.equal(devMgrOutsideToggleRes.status, 403, "Dev manager must be denied access (403) to patch shop outside dev campus");

      // --- VERIFICATION 3: Staff assigned to Shop A CANNOT access Shop B ---
      const staffShopBOrdersReq = createApiRequest(`http://localhost:3000/api/shops/${shopB.id}/orders`, {
        userId: DEV_STAFF_ID,
      });
      const staffShopBOrdersRes = await listShopOrdersRoute(staffShopBOrdersReq, {
        params: Promise.resolve({ shopId: shopB.id }),
      });
      assert.equal(staffShopBOrdersRes.status, 403, "Staff assigned to Shop A must be denied access (403) to Shop B");

      const staffShopBToggleReq = createApiRequest(`http://localhost:3000/api/shops/${shopB.id}`, {
        method: "PATCH",
        userId: DEV_STAFF_ID,
        body: { isOpen: true },
      });
      const staffShopBToggleRes = await patchShopRoute(staffShopBToggleReq, {
        params: Promise.resolve({ shopId: shopB.id }),
      });
      assert.equal(staffShopBToggleRes.status, 403, "Staff assigned to Shop A must be denied access (403) to patch Shop B");

      // --- VERIFICATION 4: Normal manager/owner membership checks remain enforced outside the development bypass ---
      // 4a. Normal manager can access their assigned Shop A
      const normalMgrShopAReq = createApiRequest(`http://localhost:3000/api/shops/${SEED_SHOP_ID}/orders`, {
        userId: normalManagerUser.id,
      });
      const normalMgrShopARes = await listShopOrdersRoute(normalMgrShopAReq, {
        params: Promise.resolve({ shopId: SEED_SHOP_ID }),
      });
      assert.equal(normalMgrShopARes.status, 200, "Normal manager must access their assigned Shop A");

      // 4b. Normal manager CANNOT access Shop B in the same campus (unassigned)
      const normalMgrShopBReq = createApiRequest(`http://localhost:3000/api/shops/${shopB.id}/orders`, {
        userId: normalManagerUser.id,
      });
      const normalMgrShopBRes = await listShopOrdersRoute(normalMgrShopBReq, {
        params: Promise.resolve({ shopId: shopB.id }),
      });
      assert.equal(normalMgrShopBRes.status, 403, "Normal manager must be rejected (403) from unassigned Shop B");

      // --- VERIFICATION 5: Production mode rejects development-only access ---
      const prevEnv = process.env.NODE_ENV;
      try {
        (process.env as Record<string, string>).NODE_ENV = "production";

        const prodDevMgrReq = createApiRequest(`http://localhost:3000/api/shops/${shopB.id}/orders`, {
          userId: DEV_MANAGER_ID,
          cookie: `collega_dev_user_id=${DEV_MANAGER_ID}`,
        });
        const prodSession = await getCurrentSession(prodDevMgrReq);
        assert.equal(prodSession, null, "getCurrentSession must return null for DEV_MANAGER_ID in production");

        const prodRes = await listShopOrdersRoute(prodDevMgrReq, {
          params: Promise.resolve({ shopId: shopB.id }),
        });
        assert.equal(prodRes.status, 401, "API routes must return 401 for DEV_MANAGER_ID in production");
      } finally {
        (process.env as Record<string, string>).NODE_ENV = prevEnv;
      }

      console.log("✔ Scenario 10: Stage 2 Development Manager Multi-Shop Access & Cross-Campus / Staff Isolation verified.");
    }

    console.log("\n========================================================");
    console.log("  ALL SHOP PORTAL TESTS PASSED SUCCESSFULLY!            ");
    console.log("========================================================\n");
  } finally {
    console.log("--- Executing Narrow Run-Scoped Cleanup & Baseline Verification ---");

    if (createdStaffSessionIds.size > 0) {
      await prisma.staffSession.deleteMany({
        where: { id: { in: Array.from(createdStaffSessionIds) } },
      });
    }
    if (createdStaffInvitationIds.size > 0) {
      await prisma.staffInvitation.deleteMany({
        where: { id: { in: Array.from(createdStaffInvitationIds) } },
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
    if (createdOrderIds.size > 0) {
      await prisma.order.deleteMany({
        where: { id: { in: Array.from(createdOrderIds) } },
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
    if (createdCampusIds.size > 0) {
      await prisma.campus.deleteMany({
        where: { id: { in: Array.from(createdCampusIds) } },
      });
    }
    if (createdUserIds.size > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: Array.from(createdUserIds) } },
      });
    }

    console.log(`✔ Tracked fixtures (${createdProductIds.size} products, ${createdCategoryIds.size} categories, ${createdOrderIds.size} orders, ${createdUserIds.size} users, ${createdShopMemberIds.size} memberships, ${createdStaffInvitationIds.size} invitations, ${createdStaffSessionIds.size} sessions) deleted cleanly.`);

    // Restore shop to open if it was left closed
    await prisma.shop.update({
      where: { id: SEED_SHOP_ID },
      data: { isOpen: true },
    });

    // Check seed baseline integrity
    const [campuses, shops, categories, products, orders, users, staffSessions, staffInvitations] = await Promise.all([
      prisma.campus.count(),
      prisma.shop.count(),
      prisma.category.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.user.count(),
      prisma.staffSession.count(),
      prisma.staffInvitation.count(),
    ]);

    assert.equal(campuses, 1, "Baseline campus count altered!");
    assert.equal(shops, 1, "Baseline shop count altered!");
    assert.equal(categories, 3, "Baseline categories count altered!");
    assert.equal(products, 4, "Baseline products count altered!");
    assert.equal(orders, 0, "Leftover test orders detected!");
    assert.equal(users, 0, "Leftover test users detected!");
    assert.equal(staffSessions, 0, "Leftover staff sessions detected!");
    assert.equal(staffInvitations, 0, "Leftover staff invitations detected!");

    console.log("✔ Baseline Seed Catalog verified intact (1 Campus, 1 Shop, 3 Categories, 4 Products, 0 Leftover Orders/Users/StaffSessions).\n");
  }
}

main()
  .catch((err) => {
    console.error("\n❌ Phase 6D.1 Test Suite Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
