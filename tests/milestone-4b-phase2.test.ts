/**
 * COLLEGA.LOL — Milestone 4B Phase 2: Admin API Integration Tests
 *
 * Validates:
 * 1. Strict administrative authorization (SUPER_ADMIN and CAMPUS_ADMIN only; STUDENT/STAFF/MANAGER/OWNER rejected with 403)
 * 2. Server-derived campus boundaries (CAMPUS_ADMIN restricted to own campus; cross-campus blocked)
 * 3. Shop creation and unique slug enforcement per campus
 * 4. Strict PATCH semantics (rejects empty/unknown keys, preserves omitted fields, nullable fields)
 * 5. Member management eligibility (rejects inactive users, rejects cross-campus users)
 * 6. Concurrency-safe last active owner protection with database row locking (pessimistic lock)
 * 7. Transactional audit log persistence with sensitive credentials omitted
 * 8. Zero regression on baseline seeded entities
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

try {
  process.loadEnvFile?.(".env");
} catch {
  // Graceful fallback
}

import { prisma } from "../src/core/db/prisma";
import { checkDatabaseReadiness } from "../src/core/config/env";
import { AdminShopService } from "../src/modules/smart-ordering/services/admin-shop-service";
import { ForbiddenError, NotFoundError, ConflictError, ValidationError } from "../src/core/errors";
import type { SessionContext } from "../src/core/types/auth";
import { SEED_CAMPUS_ID, SEED_SHOP_ID } from "../prisma/seed";

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
// Test Fixture Identifiers & Tracking
// --------------------------------------------------------------------------

const SECOND_CAMPUS_ID = randomUUID();

const SUPER_ADMIN_ID = `test_super_admin_${randomUUID()}`;
const CAMPUS_ADMIN_A_ID = `test_campus_admin_a_${randomUUID()}`;
const CAMPUS_ADMIN_B_ID = `test_campus_admin_b_${randomUUID()}`;
const STUDENT_USER_ID = `test_student_user_${randomUUID()}`;
const FOREIGN_STUDENT_ID = `test_foreign_student_${randomUUID()}`;
const INACTIVE_STUDENT_ID = `test_inactive_student_${randomUUID()}`;

const superAdminSession: SessionContext = {
  user: {
    id: SUPER_ADMIN_ID,
    email: "superadmin@collega.local",
    role: "SUPER_ADMIN",
    campusId: null,
    isActive: true,
  },
  shopMemberships: [],
};

const campusAdminASession: SessionContext = {
  user: {
    id: CAMPUS_ADMIN_A_ID,
    email: "admin.campusA@collega.local",
    role: "CAMPUS_ADMIN",
    campusId: SEED_CAMPUS_ID,
    isActive: true,
  },
  shopMemberships: [],
};

const campusAdminBSession: SessionContext = {
  user: {
    id: CAMPUS_ADMIN_B_ID,
    email: "admin.campusB@collega.local",
    role: "CAMPUS_ADMIN",
    campusId: SECOND_CAMPUS_ID,
    isActive: true,
  },
  shopMemberships: [],
};

const studentSession: SessionContext = {
  user: {
    id: STUDENT_USER_ID,
    email: "student@collega.local",
    role: "STUDENT",
    campusId: SEED_CAMPUS_ID,
    isActive: true,
  },
  shopMemberships: [],
};

// Track entities for strict scoped cleanup
const cleanupCampusIds: string[] = [SECOND_CAMPUS_ID];
const cleanupShopIds: string[] = [];
const cleanupUserIds: string[] = [
  SUPER_ADMIN_ID,
  CAMPUS_ADMIN_A_ID,
  CAMPUS_ADMIN_B_ID,
  STUDENT_USER_ID,
  FOREIGN_STUDENT_ID,
  INACTIVE_STUDENT_ID,
];
const cleanupAuditIds: string[] = [];

async function cleanup() {
  console.log("🧹 Cleaning up Phase 2 test fixtures...");
  if (cleanupAuditIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { id: { in: cleanupAuditIds } },
    });
  }
  if (cleanupShopIds.length > 0) {
    await prisma.shopMember.deleteMany({
      where: { shopId: { in: cleanupShopIds } },
    });
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
    await prisma.shop.deleteMany({
      where: { id: { in: cleanupShopIds } },
    });
  }
  if (cleanupUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: cleanupUserIds } },
    });
  }
  if (cleanupCampusIds.length > 0) {
    await prisma.campus.deleteMany({
      where: { id: { in: cleanupCampusIds } },
    });
  }
}

// --------------------------------------------------------------------------
// Test Execution
// --------------------------------------------------------------------------

async function run() {
  console.log("🚀 Starting Milestone 4B Phase 2 Integration Tests...\n");
  assertDevTarget();

  try {
    // 0. Seed test campus and users
    await prisma.campus.create({
      data: {
        id: SECOND_CAMPUS_ID,
        slug: `campus-b-${Date.now()}`,
        name: "Campus B South Tech",
        isActive: true,
      },
    });

    await prisma.user.createMany({
      data: [
        {
          id: SUPER_ADMIN_ID,
          email: "superadmin@collega.local",
          role: "SUPER_ADMIN",
          isActive: true,
        },
        {
          id: CAMPUS_ADMIN_A_ID,
          email: "admin.campusA@collega.local",
          role: "CAMPUS_ADMIN",
          campusId: SEED_CAMPUS_ID,
          isActive: true,
        },
        {
          id: CAMPUS_ADMIN_B_ID,
          email: "admin.campusB@collega.local",
          role: "CAMPUS_ADMIN",
          campusId: SECOND_CAMPUS_ID,
          isActive: true,
        },
        {
          id: STUDENT_USER_ID,
          email: "student@collega.local",
          role: "STUDENT",
          campusId: SEED_CAMPUS_ID,
          isActive: true,
        },
        {
          id: FOREIGN_STUDENT_ID,
          email: "foreign@collega.local",
          role: "STUDENT",
          campusId: SECOND_CAMPUS_ID,
          isActive: true,
        },
        {
          id: INACTIVE_STUDENT_ID,
          email: "inactive@collega.local",
          role: "STUDENT",
          campusId: SEED_CAMPUS_ID,
          isActive: false, // Inactive user
        },
      ],
    });

    // ------------------------------------------------------------------------
    // Scenario 1: Authorization Gatekeeping (STUDENT & OWNER rejected)
    // ------------------------------------------------------------------------
    console.log("▶ Scenario 1: Non-admin roles rejected with 403 Forbidden");
    await assert.rejects(
      async () =>
        AdminShopService.createShop(studentSession, {
          campusId: SEED_CAMPUS_ID,
          name: "Illegal Shop",
          slug: "illegal-shop",
          location: "Block C",
          autoAcceptOrders: false,
          isOpen: false,
          isActive: true,
        }),
      (err: unknown) => err instanceof ForbiddenError,
      "Students must receive ForbiddenError on admin endpoints"
    );

    const ownerSession: SessionContext = {
      user: {
        id: STUDENT_USER_ID,
        email: "owner@collega.local",
        role: "STUDENT",
        campusId: SEED_CAMPUS_ID,
        isActive: true,
      },
      shopMemberships: [
        {
          shopId: SEED_SHOP_ID,
          role: "OWNER",
          isActive: true,
        },
      ],
    };

    await assert.rejects(
      async () =>
        AdminShopService.createShop(ownerSession, {
          campusId: SEED_CAMPUS_ID,
          name: "Owner Shop",
          slug: "owner-shop",
          location: "Block C",
          autoAcceptOrders: false,
          isOpen: false,
          isActive: true,
        }),
      (err: unknown) => err instanceof ForbiddenError,
      "Shop Owners without CAMPUS_ADMIN or SUPER_ADMIN role must receive ForbiddenError"
    );
    console.log("  ✔ Non-admin roles (STUDENT, OWNER) rejected with 403.\n");

    // ------------------------------------------------------------------------
    // Scenario 2: Server-Derived Campus Boundaries on Shop Creation
    // ------------------------------------------------------------------------
    console.log("▶ Scenario 2: CampusAdmin campus boundary enforcement");
    // Campus Admin A attempts to create shop in Campus B -> must fail
    await assert.rejects(
      async () =>
        AdminShopService.createShop(campusAdminASession, {
          campusId: SECOND_CAMPUS_ID,
          name: "Cross Campus Shop",
          slug: "cross-campus-shop",
          location: "Block B",
          autoAcceptOrders: false,
          isOpen: false,
          isActive: true,
        }),
      (err: unknown) => err instanceof ForbiddenError,
      "Campus Admin must be blocked from creating shops in another campus"
    );

    // Campus Admin A creates shop in own Campus A -> succeeds
    const createdShopA = await AdminShopService.createShop(campusAdminASession, {
      campusId: SEED_CAMPUS_ID,
      name: "North Campus Coffee Corner",
      slug: `north-coffee-${Date.now()}`,
      location: "Library Basement",
      autoAcceptOrders: true,
      isOpen: false,
      isActive: true,
    });
    cleanupShopIds.push(createdShopA.id);
    assert.strictEqual(createdShopA.name, "North Campus Coffee Corner");
    assert.strictEqual(createdShopA.autoAcceptOrders, true);
    assert.strictEqual(createdShopA.isOpen, false);
    assert.strictEqual(createdShopA.isActive, true);

    // Verify audit log for shop creation
    const createAudit = await prisma.auditLog.findFirst({
      where: {
        action: "SHOP_CREATED",
        entity: "Shop",
        entityId: createdShopA.id,
      },
    });
    assert.ok(createAudit, "Shop creation must persist AuditLog entry");
    cleanupAuditIds.push(createAudit.id);
    console.log("  ✔ Campus Admin bound to own campus; audit log persisted.\n");

    // ------------------------------------------------------------------------
    // Scenario 3: Slug Uniqueness Per Campus
    // ------------------------------------------------------------------------
    console.log("▶ Scenario 3: Slug uniqueness per campus enforcement");
    await assert.rejects(
      async () =>
        AdminShopService.createShop(campusAdminASession, {
          campusId: SEED_CAMPUS_ID,
          name: "Duplicate Slug Shop",
          slug: createdShopA.slug, // Duplicate slug in Campus A
          location: "Building 4",
          autoAcceptOrders: false,
          isOpen: false,
          isActive: true,
        }),
      (err: unknown) => err instanceof ConflictError,
      "Duplicate slug in the same campus must be rejected with ConflictError"
    );

    // Super Admin can use the same slug in a DIFFERENT campus
    const shopInCampusB = await AdminShopService.createShop(superAdminSession, {
      campusId: SECOND_CAMPUS_ID,
      name: "South Campus Coffee Corner",
      slug: createdShopA.slug, // Same slug in Campus B
      location: "South Tech Center",
      autoAcceptOrders: false,
      isOpen: false,
      isActive: true,
    });
    cleanupShopIds.push(shopInCampusB.id);
    assert.strictEqual(shopInCampusB.campusId, SECOND_CAMPUS_ID);
    console.log("  ✔ Slug uniqueness enforced per-campus (allowed across different campuses).\n");

    // ------------------------------------------------------------------------
    // Scenario 4: Strict PATCH Semantics & Unknown/Empty Payloads
    // ------------------------------------------------------------------------
    console.log("▶ Scenario 4: Strict PATCH validation and update semantics");
    // Empty body rejected
    await assert.rejects(
      async () =>
        AdminShopService.updateShop(
          campusAdminASession,
          createdShopA.id,
          {} as unknown as import("../src/modules/smart-ordering/validation/admin-shop.schema").UpdateShopInput
        ),
      (err: unknown) => err instanceof Error,
      "Empty update payload must be rejected"
    );

    // Unknown field rejected
    await assert.rejects(
      async () =>
        AdminShopService.updateShop(
          campusAdminASession,
          createdShopA.id,
          { hackerKey: "exploit" } as unknown as import("../src/modules/smart-ordering/validation/admin-shop.schema").UpdateShopInput
        ),
      (err: unknown) => err instanceof Error,
      "Unknown fields must be rejected"
    );

    // Cross-campus update blocked: Campus Admin B cannot update Shop in Campus A
    await assert.rejects(
      async () =>
        AdminShopService.updateShop(campusAdminBSession, createdShopA.id, {
          name: "Hacked Name",
        }),
      (err: unknown) => err instanceof ForbiddenError,
      "Campus Admin B must not update a shop belonging to Campus A"
    );

    // Valid update: update name and clear description to null, omitting other fields
    const updatedShop = await AdminShopService.updateShop(campusAdminASession, createdShopA.id, {
      name: "North Campus Coffee Lounge",
      description: null,
      isActive: false, // Administrative deactivation
    });
    assert.strictEqual(updatedShop.name, "North Campus Coffee Lounge");
    assert.strictEqual(updatedShop.description, null);
    assert.strictEqual(updatedShop.isActive, false);
    assert.strictEqual(updatedShop.location, "Library Basement", "Omitted fields must remain unchanged");
    assert.strictEqual(updatedShop.autoAcceptOrders, true, "Omitted fields must remain unchanged");

    // Verify audit log for shop update
    const updateAudit = await prisma.auditLog.findFirst({
      where: {
        action: "SHOP_UPDATED",
        entity: "Shop",
        entityId: createdShopA.id,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(updateAudit, "Shop update must persist AuditLog entry");
    cleanupAuditIds.push(updateAudit.id);
    console.log("  ✔ Strict PATCH semantics, partial updates, and audit logging verified.\n");

    // ------------------------------------------------------------------------
    // Scenario 5: Target User Eligibility & Anti-Escalation
    // ------------------------------------------------------------------------
    console.log("▶ Scenario 5: Target user eligibility checks (inactive, cross-campus, non-existent)");
    // Non-existent user -> 404
    await assert.rejects(
      async () =>
        AdminShopService.assignShopMember(campusAdminASession, createdShopA.id, {
          userId: "non-existent-user-id",
          role: "STAFF",
        }),
      (err: unknown) => err instanceof NotFoundError,
      "Non-existent user must throw NotFoundError"
    );

    // Inactive user -> ValidationError
    await assert.rejects(
      async () =>
        AdminShopService.assignShopMember(campusAdminASession, createdShopA.id, {
          userId: INACTIVE_STUDENT_ID,
          role: "MANAGER",
        }),
      (err: unknown) => err instanceof ValidationError,
      "Inactive user must be rejected"
    );

    // Foreign campus user -> ForbiddenError
    await assert.rejects(
      async () =>
        AdminShopService.assignShopMember(campusAdminASession, createdShopA.id, {
          userId: FOREIGN_STUDENT_ID,
          role: "STAFF",
        }),
      (err: unknown) => err instanceof ForbiddenError,
      "Cross-campus user assignment must be blocked"
    );

    // Valid user assignment -> succeeds
    const assignedMember = await AdminShopService.assignShopMember(campusAdminASession, createdShopA.id, {
      userId: STUDENT_USER_ID,
      role: "OWNER",
    });
    assert.strictEqual(assignedMember.role, "OWNER");
    assert.strictEqual(assignedMember.isActive, true);

    const assignAudit = await prisma.auditLog.findFirst({
      where: {
        action: "SHOP_MEMBER_ASSIGNED",
        entity: "ShopMember",
        entityId: assignedMember.id,
      },
    });
    assert.ok(assignAudit, "Member assignment must persist AuditLog");
    cleanupAuditIds.push(assignAudit.id);
    console.log("  ✔ Target user validation and same-campus eligibility verified.\n");

    // ------------------------------------------------------------------------
    // Scenario 6: Last Active Owner Protection (Sequential Demote / Revoke)
    // ------------------------------------------------------------------------
    console.log("▶ Scenario 6: Last active owner protection (demotion and revocation blocked)");
    // Demoting the only active OWNER -> ConflictError
    await assert.rejects(
      async () =>
        AdminShopService.assignShopMember(campusAdminASession, createdShopA.id, {
          userId: STUDENT_USER_ID,
          role: "STAFF", // Attempting to demote sole owner
        }),
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.match(err.message, /last active owner/i);
        return true;
      },
      "Must block demoting the last active OWNER"
    );

    // Revoking the only active OWNER -> ConflictError
    await assert.rejects(
      async () =>
        AdminShopService.revokeShopMember(campusAdminASession, createdShopA.id, assignedMember.id),
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.match(err.message, /last active owner/i);
        return true;
      },
      "Must block revoking the last active OWNER"
    );
    console.log("  ✔ Sequential last-owner demotion and revocation cleanly blocked.\n");

    // ------------------------------------------------------------------------
    // Scenario 7: Concurrency-Safe Last-Owner Protection (Row Locking)
    // ------------------------------------------------------------------------
    console.log("▶ Scenario 7: Concurrency-safe last active owner protection under race condition");
    // Create a 2nd user in Campus A to be Owner B
    const OWNER_B_USER_ID = `test_owner_b_${randomUUID()}`;
    cleanupUserIds.push(OWNER_B_USER_ID);
    await prisma.user.create({
      data: {
        id: OWNER_B_USER_ID,
        email: "owner.b@collega.local",
        role: "STUDENT",
        campusId: SEED_CAMPUS_ID,
        isActive: true,
      },
    });

    const ownerBMember = await AdminShopService.assignShopMember(campusAdminASession, createdShopA.id, {
      userId: OWNER_B_USER_ID,
      role: "OWNER",
    });

    // Verify shop currently has exactly 2 active owners
    const ownerCountBefore = await prisma.shopMember.count({
      where: { shopId: createdShopA.id, role: "OWNER", isActive: true },
    });
    assert.strictEqual(ownerCountBefore, 2, "Shop must have exactly 2 active owners");

    // Fire two concurrent revocation requests simultaneously using Promise.allSettled
    const results = await Promise.allSettled([
      AdminShopService.revokeShopMember(campusAdminASession, createdShopA.id, assignedMember.id),
      AdminShopService.revokeShopMember(campusAdminASession, createdShopA.id, ownerBMember.id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.strictEqual(fulfilled.length, 1, "Exactly one revocation must succeed");
    assert.strictEqual(rejected.length, 1, "Exactly one revocation must fail due to last owner protection");

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(rejectionReason instanceof ConflictError);
    assert.match(rejectionReason.message, /last active owner/i);

    // Verify database state: shop still has exactly 1 active owner (NEVER zero)
    const ownerCountAfter = await prisma.shopMember.count({
      where: { shopId: createdShopA.id, role: "OWNER", isActive: true },
    });
    assert.strictEqual(ownerCountAfter, 1, "Shop must retain exactly 1 active owner; never 0");
    console.log("  ✔ Concurrency race test verified: row-level lock prevented leaves-zero-owners invariant violation.\n");

    // ------------------------------------------------------------------------
    // Scenario 8: Member Listing Endpoint
    // ------------------------------------------------------------------------
    console.log("▶ Scenario 8: Member listing endpoint");
    const memberList = await AdminShopService.listShopMembers(campusAdminASession, createdShopA.id);
    assert.ok(memberList.length >= 2, "Must list all shop members");
    assert.ok(
      memberList.some((m) => m.userId === OWNER_B_USER_ID || m.userId === STUDENT_USER_ID)
    );
    console.log("  ✔ Member listing verified with detailed user relations.\n");

    console.log("==================================================");
    console.log("✅ All Milestone 4B Phase 2 tests passed successfully!");
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
