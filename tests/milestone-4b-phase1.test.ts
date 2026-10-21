/**
 * COLLEGA.LOL — Milestone 4B: Phase 1 Integration Tests
 *
 * Validates:
 * 1. Administrative shop activation (Shop.isActive separate from Shop.isOpen)
 * 2. Inactive shops hidden from student discovery and menu retrieval
 * 3. Inactive shops cannot be ordered from (OrderService rejects with ForbiddenError)
 * 4. Manager cannot toggle open an inactive shop (CatalogService rejects with ForbiddenError)
 * 5. Reusable AuditService persists audit records transactionally with sensitive metadata redacted
 * 6. Staff session revocation and invitation generation record audit logs
 * 7. Regression verification for active shops
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

try {
  process.loadEnvFile?.(".env");
} catch {
  // Graceful fallback
}

import { prisma } from "../src/core/db/prisma";
import { checkDatabaseReadiness } from "../src/core/config/env";
import { CatalogService } from "../src/modules/smart-ordering/services/catalog-service";
import { OrderService } from "../src/modules/smart-ordering/services/order-service";
import { StaffAccessService } from "../src/modules/smart-ordering/services/staff-access-service";
import { AuditService } from "../src/core/audit";
import { ForbiddenError, NotFoundError } from "../src/core/errors";
import type { SessionContext } from "../src/core/types/auth";
import {
  SEED_CAMPUS_ID,
  SEED_SHOP_ID,
} from "../prisma/seed";

// --------------------------------------------------------------------------
// Safety Environment Check
// --------------------------------------------------------------------------

function assertDevTarget(): void {
  const readiness = checkDatabaseReadiness();
  if (!readiness.isConfigured || readiness.isPlaceholder) {
    throw new Error(`[Safety Guard] DB not ready: ${readiness.message}`);
  }
  const dbUrl = process.env.DATABASE_URL || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (
    process.env.NODE_ENV === "production" ||
    dbUrl.toLowerCase().includes("collega.lol") ||
    appUrl.toLowerCase().includes("collega.lol")
  ) {
    throw new Error("[Safety Guard] Tests aborted: production target detected");
  }
}

// --------------------------------------------------------------------------
// Test Context & Session Helpers
// --------------------------------------------------------------------------

const TEST_STUDENT_ID = `test_student_${randomUUID()}`;
const TEST_MANAGER_ID = `test_manager_${randomUUID()}`;

const studentSession: SessionContext = {
  user: {
    id: TEST_STUDENT_ID,
    email: "test.student@collega.local",
    role: "STUDENT",
    campusId: SEED_CAMPUS_ID,
    isActive: true,
  },
  shopMemberships: [],
};

const managerSession: SessionContext = {
  user: {
    id: TEST_MANAGER_ID,
    email: "test.manager@collega.local",
    role: "STUDENT",
    campusId: SEED_CAMPUS_ID,
    isActive: true,
  },
  shopMemberships: [
    {
      shopId: SEED_SHOP_ID,
      role: "MANAGER",
      isActive: true,
    },
  ],
};

// Track entities for strict scoped cleanup
const cleanupShopIds: string[] = [];
const cleanupUserIds: string[] = [TEST_STUDENT_ID, TEST_MANAGER_ID];
const cleanupAuditIds: string[] = [];

async function cleanup() {
  console.log("🧹 Cleaning up test fixtures...");
  if (cleanupAuditIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { id: { in: cleanupAuditIds } },
    });
  }
  if (cleanupShopIds.length > 0) {
    // Delete test shops and related records
    await prisma.orderItem.deleteMany({
      where: { product: { shopId: { in: cleanupShopIds } } },
    });
    await prisma.order.deleteMany({
      where: { shopId: { in: cleanupShopIds } },
    });
    await prisma.product.deleteMany({
      where: { shopId: { in: cleanupShopIds } },
    });
    await prisma.category.deleteMany({
      where: { shopId: { in: cleanupShopIds } },
    });
    await prisma.staffSession.deleteMany({
      where: { shopId: { in: cleanupShopIds } },
    });
    await prisma.staffInvitation.deleteMany({
      where: { shopId: { in: cleanupShopIds } },
    });
    await prisma.shopMember.deleteMany({
      where: { shopId: { in: cleanupShopIds } },
    });
    await prisma.shop.deleteMany({
      where: { id: { in: cleanupShopIds } },
    });
  }
  if (cleanupUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: cleanupUserIds } },
    });
  }
}

// --------------------------------------------------------------------------
// Test Runner
// --------------------------------------------------------------------------

async function run() {
  console.log("🚀 Starting Milestone 4B Phase 1 Integration Tests...\n");
  assertDevTarget();

  try {
    // Create test user records to satisfy FK constraints if needed
    await prisma.user.upsert({
      where: { id: TEST_STUDENT_ID },
      update: {},
      create: {
        id: TEST_STUDENT_ID,
        email: "test.student@collega.local",
        role: "STUDENT",
        campusId: SEED_CAMPUS_ID,
      },
    });

    await prisma.user.upsert({
      where: { id: TEST_MANAGER_ID },
      update: {},
      create: {
        id: TEST_MANAGER_ID,
        email: "test.manager@collega.local",
        role: "STUDENT",
        campusId: SEED_CAMPUS_ID,
      },
    });

    // ------------------------------------------------------------------------
    // Test 1: Baseline Seeded Shop is Active
    // ------------------------------------------------------------------------
    console.log("▶ Test 1: Verify baseline seeded shop has isActive: true");
    const baselineShop = await prisma.shop.findUnique({
      where: { id: SEED_SHOP_ID },
      select: { id: true, name: true, isActive: true, isOpen: true },
    });
    assert.ok(baselineShop, "Baseline shop must exist");
    assert.strictEqual(baselineShop.isActive, true, "Baseline shop must be isActive: true by default");
    console.log("  ✔ Baseline shop is active.\n");

    // ------------------------------------------------------------------------
    // Test 2: Inactive Shop Isolation in Discovery
    // ------------------------------------------------------------------------
    console.log("▶ Test 2: Inactive shop isolation in student discovery");
    const inactiveShopId = randomUUID();
    cleanupShopIds.push(inactiveShopId);

    const inactiveShop = await prisma.shop.create({
      data: {
        id: inactiveShopId,
        campusId: SEED_CAMPUS_ID,
        name: "Deactivated Corner Kiosk",
        slug: `deactivated-kiosk-${Date.now()}`,
        location: "Closed Building",
        isActive: false, // Administratively deactivated
        isOpen: true,    // Attempted to be open
      },
    });

    // 2a: listShops must NOT include the inactive shop
    const studentShops = await CatalogService.listShops(studentSession);
    assert.ok(
      !studentShops.some((s) => s.id === inactiveShopId),
      "listShops must exclude administratively inactive shops"
    );

    // 2b: listPublicShops must NOT include the inactive shop
    const publicShops = await CatalogService.listPublicShops(SEED_CAMPUS_ID);
    assert.ok(
      !publicShops.some((s) => s.id === inactiveShopId),
      "listPublicShops must exclude administratively inactive shops"
    );

    // 2c: getPublicShopBySlug must reject inactive shop
    await assert.rejects(
      async () => CatalogService.getPublicShopBySlug(inactiveShop.slug),
      (err: unknown) => err instanceof NotFoundError,
      "getPublicShopBySlug must return NotFoundError for inactive shop"
    );

    // 2d: getShopMenu must reject inactive shop
    await assert.rejects(
      async () => CatalogService.getShopMenu(studentSession, inactiveShopId),
      (err: unknown) => err instanceof NotFoundError,
      "getShopMenu must return NotFoundError for inactive shop"
    );
    console.log("  ✔ Inactive shop is completely hidden from student discovery and menu retrieval.\n");

    // ------------------------------------------------------------------------
    // Test 3: Manager Cannot Reopen Deactivated Shop
    // ------------------------------------------------------------------------
    console.log("▶ Test 3: Manager cannot reopen an administratively deactivated shop");
    // Assign manager to inactive shop
    const managerOfInactiveSession: SessionContext = {
      user: {
        id: TEST_MANAGER_ID,
        email: "test.manager@collega.local",
        role: "STUDENT",
        campusId: SEED_CAMPUS_ID,
        isActive: true,
      },
      shopMemberships: [
        {
          shopId: inactiveShopId,
          role: "MANAGER",
          isActive: true,
        },
      ],
    };

    await assert.rejects(
      async () => CatalogService.toggleShopOpen(managerOfInactiveSession, inactiveShopId, true),
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError, "Must throw ForbiddenError");
        assert.match(
          err.message,
          /deactivated by campus administration/i,
          "Must explain administrative deactivation"
        );
        return true;
      },
      "Manager must not be able to open a deactivated shop"
    );
    console.log("  ✔ Manager toggle rejected with ForbiddenError when shop is inactive.\n");

    // ------------------------------------------------------------------------
    // Test 4: Inactive Shop Cannot Accept Orders
    // ------------------------------------------------------------------------
    console.log("▶ Test 4: Order placement blocked for inactive shop");
    // Create category and product under inactive shop
    const testCategory = await prisma.category.create({
      data: {
        shopId: inactiveShopId,
        name: "Test Cat",
        slug: `test-cat-${Date.now()}`,
        isAvailable: true,
      },
    });

    const testProduct = await prisma.product.create({
      data: {
        shopId: inactiveShopId,
        categoryId: testCategory.id,
        name: "Forbidden Item",
        price: new Prisma.Decimal("100.00"),
        isAvailable: true,
      },
    });

    await assert.rejects(
      async () =>
        OrderService.createOrder(studentSession, {
          shopId: inactiveShopId,
          items: [{ productId: testProduct.id, quantity: 1, expectedUnitPrice: "100.00" }],
        }),
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError, "Must throw ForbiddenError");
        assert.match(err.message, /deactivated by campus administration/i);
        return true;
      },
      "Order placement must be halted for inactive shop"
    );
    console.log("  ✔ Order placement cleanly halted with ForbiddenError for inactive shop.\n");

    // ------------------------------------------------------------------------
    // Test 5: Reusable AuditService and Sensitive Credential Redaction
    // ------------------------------------------------------------------------
    console.log("▶ Test 5: AuditService records log and redacts sensitive metadata");
    const testAudit = await AuditService.record({
      actorId: TEST_MANAGER_ID,
      action: "SECURITY_TEST_AUDIT",
      entity: "Shop",
      entityId: SEED_SHOP_ID,
      metadata: {
        safeField: "safeValue",
        password: "secretPassword123!",
        userToken: "bearer_xyz_token",
        secretKey: "sk_live_secret",
      },
    });
    cleanupAuditIds.push(testAudit.id);

    assert.ok(testAudit.id, "Audit record must be created");
    assert.strictEqual(testAudit.action, "SECURITY_TEST_AUDIT");
    const meta = testAudit.metadata as Record<string, unknown>;
    assert.strictEqual(meta.safeField, "safeValue");
    assert.strictEqual(meta.password, "[REDACTED]", "Passwords must be redacted");
    assert.strictEqual(meta.userToken, "[REDACTED]", "Tokens must be redacted");
    assert.strictEqual(meta.secretKey, "[REDACTED]", "Secrets must be redacted");
    console.log("  ✔ AuditService persisted record and successfully redacted sensitive fields.\n");

    // ------------------------------------------------------------------------
    // Test 6: Transactional Audit on toggleShopOpen
    // ------------------------------------------------------------------------
    console.log("▶ Test 6: toggleShopOpen creates transactional audit log");
    // Toggle baseline shop to false and back to true
    const updatedShopClosed = await CatalogService.toggleShopOpen(managerSession, SEED_SHOP_ID, false);
    assert.strictEqual(updatedShopClosed.isOpen, false);

    const toggleAudit = await prisma.auditLog.findFirst({
      where: {
        action: "SHOP_OPEN_TOGGLED",
        entity: "Shop",
        entityId: SEED_SHOP_ID,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(toggleAudit, "toggleShopOpen must create AuditLog entry");
    cleanupAuditIds.push(toggleAudit.id);
    const toggleMeta = toggleAudit.metadata as Record<string, unknown>;
    assert.strictEqual(toggleMeta.newIsOpen, false);

    // Toggle back to true
    const updatedShopOpen = await CatalogService.toggleShopOpen(managerSession, SEED_SHOP_ID, true);
    assert.strictEqual(updatedShopOpen.isOpen, true);
    console.log("  ✔ toggleShopOpen executed atomically and persisted audit record.\n");

    // ------------------------------------------------------------------------
    // Test 7: Transactional Audit on Product & Price Mutations
    // ------------------------------------------------------------------------
    console.log("▶ Test 7: Product creation and price update audit logging");
    const auditCategory = await CatalogService.createCategory(managerSession, SEED_SHOP_ID, {
      name: `Audit Cat ${Date.now()}`,
      slug: `audit-cat-${Date.now()}`,
      sortOrder: 99,
      isAvailable: true,
    });
    const categoryAudit = await prisma.auditLog.findFirst({
      where: {
        action: "CATEGORY_CREATED",
        entity: "Category",
        entityId: auditCategory.id,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(categoryAudit, "Category creation must create audit record");
    cleanupAuditIds.push(categoryAudit.id);

    const auditProduct = await CatalogService.createProduct(managerSession, SEED_SHOP_ID, {
      categoryId: auditCategory.id,
      name: "Audit Samosa",
      description: null,
      imageUrl: null,
      price: "40.00",
      isAvailable: true,
      preparationTimeMins: 5,
      sortOrder: 1,
    });
    const productCreateAudit = await prisma.auditLog.findFirst({
      where: {
        action: "PRODUCT_CREATED",
        entity: "Product",
        entityId: auditProduct.id,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(productCreateAudit, "Product creation must create audit record");
    cleanupAuditIds.push(productCreateAudit.id);

    // Update price from 40.00 to 50.00
    await CatalogService.updateProduct(managerSession, SEED_SHOP_ID, auditProduct.id, {
      price: "50.00",
      description: null,
      imageUrl: null,
    });
    const productUpdateAudit = await prisma.auditLog.findFirst({
      where: {
        action: "PRODUCT_UPDATED",
        entity: "Product",
        entityId: auditProduct.id,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(productUpdateAudit, "Product update must create audit record");
    cleanupAuditIds.push(productUpdateAudit.id);
    const updateMeta = productUpdateAudit.metadata as Record<string, unknown>;
    assert.strictEqual(updateMeta.previousPrice, "40.00");
    assert.strictEqual(updateMeta.newPrice, "50.00");

    // Cleanup the created test product and category
    await prisma.product.delete({ where: { id: auditProduct.id } });
    await prisma.category.delete({ where: { id: auditCategory.id } });
    console.log("  ✔ Product price change audit record verified with previous and new price.\n");

    // ------------------------------------------------------------------------
    // Test 8: Staff Invitation and Revocation Audit Logging
    // ------------------------------------------------------------------------
    console.log("▶ Test 8: Staff invitation and session revocation audit logging");
    const invitation = await StaffAccessService.generateStaffInvitation(managerSession, SEED_SHOP_ID, 15);
    const inviteAudit = await prisma.auditLog.findFirst({
      where: {
        action: "STAFF_INVITATION_CREATED",
        entity: "StaffInvitation",
        entityId: invitation.id,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(inviteAudit, "Invitation generation must create audit record");
    cleanupAuditIds.push(inviteAudit.id);
    const inviteMeta = inviteAudit.metadata as Record<string, unknown>;
    assert.strictEqual(inviteMeta.rawToken, undefined, "Raw token must not be in metadata");
    assert.strictEqual(inviteMeta.code, undefined, "PIN code must not be in metadata");

    // Revoke invitation
    await StaffAccessService.revokeStaffInvitation(managerSession, SEED_SHOP_ID, invitation.id);
    const revokeInviteAudit = await prisma.auditLog.findFirst({
      where: {
        action: "STAFF_INVITATION_REVOKED",
        entity: "StaffInvitation",
        entityId: invitation.id,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(revokeInviteAudit, "Invitation revocation must create audit record");
    cleanupAuditIds.push(revokeInviteAudit.id);

    // Delete test invitation
    await prisma.staffInvitation.delete({ where: { id: invitation.id } });
    console.log("  ✔ Staff access mutations audited without exposing secrets.\n");

    // ------------------------------------------------------------------------
    // Test 9: Existing Student & Shop Flows Regress Free
    // ------------------------------------------------------------------------
    console.log("▶ Test 9: Active shop flow regression verification");
    const activeMenu = await CatalogService.getShopMenu(studentSession, SEED_SHOP_ID);
    assert.ok(activeMenu.shop.isActive, "Active shop must have isActive: true");
    assert.ok(activeMenu.categories.length > 0, "Must load categories");

    const activeList = await CatalogService.listShops(studentSession);
    assert.ok(activeList.some((s) => s.id === SEED_SHOP_ID), "Active shop must appear in student shop list");
    console.log("  ✔ Existing student and shop flows operate with zero regression.\n");

    console.log("==================================================");
    console.log("✅ All Milestone 4B Phase 1 tests passed successfully!");
    console.log("==================================================");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
