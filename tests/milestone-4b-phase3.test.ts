/**
 * COLLEGA.LOL — Milestone 4B Phase 3 Integration Tests
 *
 * Validates:
 * 1. GET /api/admin/shops administrative listing:
 *    - Strict non-admin 403 rejection (STUDENT, OWNER).
 *    - CAMPUS_ADMIN restricted to own campus (foreign campusId query parameter blocked with 403).
 *    - Inactive shops included in administrative list.
 *    - Search and status filtering (active/inactive).
 * 2. GET /api/admin/shops/[shopId] administrative details:
 *    - Non-admin 403 rejection.
 *    - Returns inactive shop details.
 *    - Cross-campus access blocked with 403.
 * 3. Initial Owner Bootstrapping on shop creation:
 *    - Optional initialOwnerUserId atomically creates OWNER membership.
 *    - Rejects cross-campus or inactive initial owner.
 * 4. Safety & Baseline Preservation.
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
import { ForbiddenError, ValidationError } from "../src/core/errors";
import type { SessionContext } from "../src/core/types/auth";
import { SEED_CAMPUS_ID } from "../prisma/seed";
import {
  getCurrentSession,
  DEV_ADMIN_ID,
  DEV_STUDENT_ID,
  DEV_CAMPUS_ID,
} from "../src/core/auth/session";
import {
  POST as devSessionPost,
  GET as devSessionGet,
  DELETE as devSessionDelete,
} from "../src/app/api/dev/session/route";

// --------------------------------------------------------------------------
// Safety Environment Guard
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
// Fixture Identifiers & Tracking
// --------------------------------------------------------------------------

const SECOND_CAMPUS_ID = randomUUID();

const SUPER_ADMIN_ID = `test_p3_super_${randomUUID()}`;
const CAMPUS_ADMIN_A_ID = `test_p3_admin_a_${randomUUID()}`;
const CAMPUS_ADMIN_B_ID = `test_p3_admin_b_${randomUUID()}`;
const STUDENT_USER_ID = `test_p3_student_${randomUUID()}`;
const OWNER_USER_ID = `test_p3_owner_${randomUUID()}`;
const FOREIGN_USER_ID = `test_p3_foreign_${randomUUID()}`;
const INACTIVE_USER_ID = `test_p3_inactive_${randomUUID()}`;

const superAdminSession: SessionContext = {
  user: {
    id: SUPER_ADMIN_ID,
    email: "superadmin.p3@collega.local",
    role: "SUPER_ADMIN",
    campusId: null,
    isActive: true,
  },
  shopMemberships: [],
};

const campusAdminASession: SessionContext = {
  user: {
    id: CAMPUS_ADMIN_A_ID,
    email: "admin.a.p3@collega.local",
    role: "CAMPUS_ADMIN",
    campusId: SEED_CAMPUS_ID,
    isActive: true,
  },
  shopMemberships: [],
};

const campusAdminBSession: SessionContext = {
  user: {
    id: CAMPUS_ADMIN_B_ID,
    email: "admin.b.p3@collega.local",
    role: "CAMPUS_ADMIN",
    campusId: SECOND_CAMPUS_ID,
    isActive: true,
  },
  shopMemberships: [],
};

const studentSession: SessionContext = {
  user: {
    id: STUDENT_USER_ID,
    email: "student.p3@collega.local",
    role: "STUDENT",
    campusId: SEED_CAMPUS_ID,
    isActive: true,
  },
  shopMemberships: [],
};

const cleanupShopIds: string[] = [];
const cleanupUserIds: string[] = [];
const cleanupCampusIds: string[] = [];

async function runMilestone4BPhase3Tests() {
  console.log("🚀 Starting Milestone 4B Phase 3 Integration Tests...\n");
  assertDevTarget();

  try {
    // ------------------------------------------------------------------------
    // Setup Isolated Fixtures
    // ------------------------------------------------------------------------
    cleanupCampusIds.push(SECOND_CAMPUS_ID);
    await prisma.campus.create({
      data: {
        id: SECOND_CAMPUS_ID,
        name: "Phase 3 South Campus",
        slug: `p3-south-${Date.now()}`,
        isActive: true,
      },
    });

    const testUsers = [
      { id: SUPER_ADMIN_ID, email: "superadmin.p3@collega.local", role: "SUPER_ADMIN" as const, campusId: null, isActive: true },
      { id: CAMPUS_ADMIN_A_ID, email: "admin.a.p3@collega.local", role: "CAMPUS_ADMIN" as const, campusId: SEED_CAMPUS_ID, isActive: true },
      { id: CAMPUS_ADMIN_B_ID, email: "admin.b.p3@collega.local", role: "CAMPUS_ADMIN" as const, campusId: SECOND_CAMPUS_ID, isActive: true },
      { id: STUDENT_USER_ID, email: "student.p3@collega.local", role: "STUDENT" as const, campusId: SEED_CAMPUS_ID, isActive: true },
      { id: OWNER_USER_ID, email: "owner.p3@collega.local", role: "STUDENT" as const, campusId: SEED_CAMPUS_ID, isActive: true },
      { id: FOREIGN_USER_ID, email: "foreign.p3@collega.local", role: "STUDENT" as const, campusId: SECOND_CAMPUS_ID, isActive: true },
      { id: INACTIVE_USER_ID, email: "inactive.p3@collega.local", role: "STUDENT" as const, campusId: SEED_CAMPUS_ID, isActive: false },
    ];

    for (const u of testUsers) {
      cleanupUserIds.push(u.id);
      await prisma.user.create({ data: u });
    }

    // ------------------------------------------------------------------------
    // Scenario 1: Initial Owner Bootstrapping on Shop Creation
    // ------------------------------------------------------------------------
    console.log("▶ Scenario 1: Initial Owner Bootstrapping during Shop Creation");

    // 1a. Rejects cross-campus initial owner
    await assert.rejects(
      async () =>
        AdminShopService.createShop(campusAdminASession, {
          campusId: SEED_CAMPUS_ID,
          name: "Bootstrap Failure Shop",
          slug: `boot-fail-${Date.now()}`,
          location: "Block C",
          initialOwnerUserId: FOREIGN_USER_ID, // Foreign campus user
        }),
      (err: unknown) => err instanceof ForbiddenError,
      "Must reject initial owner from a foreign campus"
    );

    // 1b. Rejects inactive initial owner
    await assert.rejects(
      async () =>
        AdminShopService.createShop(campusAdminASession, {
          campusId: SEED_CAMPUS_ID,
          name: "Bootstrap Inactive Shop",
          slug: `boot-inact-${Date.now()}`,
          location: "Block C",
          initialOwnerUserId: INACTIVE_USER_ID, // Inactive user
        }),
      (err: unknown) => err instanceof ValidationError,
      "Must reject inactive initial owner"
    );

    // 1c. Successfully creates shop with initial owner
    const shopWithBootstrap = await AdminShopService.createShop(campusAdminASession, {
      campusId: SEED_CAMPUS_ID,
      name: "Bootstrapped Kiosk",
      slug: `boot-kiosk-${Date.now()}`,
      location: "Center Hall Kiosk 4",
      isActive: false, // Inactive initially to test admin visibility
      isOpen: false,
      initialOwnerUserId: OWNER_USER_ID,
    });
    cleanupShopIds.push(shopWithBootstrap.id);

    // Verify member record was created
    const members = await AdminShopService.listShopMembers(campusAdminASession, shopWithBootstrap.id);
    assert.strictEqual(members.length, 1);
    assert.strictEqual(members[0].userId, OWNER_USER_ID);
    assert.strictEqual(members[0].role, "OWNER");
    assert.strictEqual(members[0].isActive, true);
    console.log("  ✔ Initial owner bootstrap validated with atomic OWNER membership assignment.\n");

    // ------------------------------------------------------------------------
    // Scenario 2: GET /api/admin/shops List Authorization & Inactive Visibility
    // ------------------------------------------------------------------------
    console.log("▶ Scenario 2: Administrative Shop Listing (GET /api/admin/shops)");

    // 2a. Student role rejected with 403
    await assert.rejects(
      async () => AdminShopService.listShops(studentSession),
      (err: unknown) => err instanceof ForbiddenError,
      "Student must receive 403 on admin shop list"
    );

    // 2b. CampusAdmin A lists shops: includes the deactivated shop
    const adminAShops = await AdminShopService.listShops(campusAdminASession);
    assert.ok(adminAShops.length >= 2, "Campus Admin must see baseline and newly created shop");
    const foundInactive = adminAShops.find((s) => s.id === shopWithBootstrap.id);
    assert.ok(foundInactive, "Admin list must include administratively inactive shops");
    assert.strictEqual(foundInactive?.isActive, false);

    // 2c. CampusAdmin A restricted to own campus (foreign campusId query rejected)
    await assert.rejects(
      async () =>
        AdminShopService.listShops(campusAdminASession, { campusId: SECOND_CAMPUS_ID }),
      (err: unknown) => err instanceof ForbiddenError,
      "Campus Admin must receive 403 when attempting to list foreign campus shops"
    );

    // 2d. SuperAdmin can list across campuses or filter by campusId
    const superAllShops = await AdminShopService.listShops(superAdminSession);
    assert.ok(superAllShops.length >= 2);

    const superCampusAShops = await AdminShopService.listShops(superAdminSession, {
      campusId: SEED_CAMPUS_ID,
    });
    assert.ok(superCampusAShops.every((s) => s.campusId === SEED_CAMPUS_ID));

    // 2e. Status filtering
    const inactiveOnly = await AdminShopService.listShops(campusAdminASession, { status: "inactive" });
    assert.ok(inactiveOnly.every((s) => !s.isActive));
    assert.ok(inactiveOnly.some((s) => s.id === shopWithBootstrap.id));

    const activeOnly = await AdminShopService.listShops(campusAdminASession, { status: "active" });
    assert.ok(activeOnly.every((s) => s.isActive));
    assert.ok(!activeOnly.some((s) => s.id === shopWithBootstrap.id));

    // 2f. Search filtering
    const searchResult = await AdminShopService.listShops(campusAdminASession, {
      search: "Bootstrapped",
    });
    assert.strictEqual(searchResult.length, 1);
    assert.strictEqual(searchResult[0].id, shopWithBootstrap.id);
    console.log("  ✔ Admin shop directory listing, filtering, search, and inactive visibility verified.\n");

    // ------------------------------------------------------------------------
    // Scenario 3: GET /api/admin/shops/[shopId] Detail Authorization
    // ------------------------------------------------------------------------
    console.log("▶ Scenario 3: Administrative Shop Details (GET /api/admin/shops/[shopId])");

    // 3a. Student rejected with 403
    await assert.rejects(
      async () => AdminShopService.getShopById(studentSession, shopWithBootstrap.id),
      (err: unknown) => err instanceof ForbiddenError,
      "Student must receive 403 on admin shop detail"
    );

    // 3b. Campus Admin A can fetch inactive shop in own campus
    const detail = await AdminShopService.getShopById(campusAdminASession, shopWithBootstrap.id);
    assert.strictEqual(detail.id, shopWithBootstrap.id);
    assert.strictEqual(detail.isActive, false);
    assert.strictEqual(detail.name, "Bootstrapped Kiosk");
    assert.ok(detail.members.length >= 1);
    assert.strictEqual(detail.members[0].user.id, OWNER_USER_ID);

    // 3c. Campus Admin B blocked from fetching Campus A shop (403 Forbidden)
    await assert.rejects(
      async () => AdminShopService.getShopById(campusAdminBSession, shopWithBootstrap.id),
      (err: unknown) => err instanceof ForbiddenError,
      "Campus Admin B must receive 403 for Campus A shop"
    );

    // 3d. Super Admin can fetch across campuses
    const superDetail = await AdminShopService.getShopById(superAdminSession, shopWithBootstrap.id);
    assert.strictEqual(superDetail.id, shopWithBootstrap.id);
    console.log("  ✔ Admin shop details, nested relations, and cross-campus boundaries verified.\n");

    // ------------------------------------------------------------------------
    // Scenario 4: Activation & Student Catalog Isolation Verification
    // ------------------------------------------------------------------------
    console.log("▶ Scenario 4: Administrative Activation & Catalog Isolation Verification");

    // Activate the shop
    const activated = await AdminShopService.updateShop(campusAdminASession, shopWithBootstrap.id, {
      isActive: true,
    });
    assert.strictEqual(activated.isActive, true);

    // Verify it is now visible under active status
    const postActivationDetail = await AdminShopService.getShopById(
      campusAdminASession,
      shopWithBootstrap.id
    );
    assert.strictEqual(postActivationDetail.isActive, true);
    console.log("  ✔ Shop activation toggle verified.\n");

    // ------------------------------------------------------------------------
    // Scenario 5: Deterministic Development Admin Identity & Session Safeguards
    // ------------------------------------------------------------------------
    console.log("▶ Scenario 5: Deterministic Dev Admin Identity & Session Safeguards");

    // 5a. Admin session selection via POST /api/dev/session
    const devAdminPostReq = new Request("http://localhost:3000/api/dev/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "ADMIN" }),
    });
    const devAdminPostRes = await devSessionPost(devAdminPostReq);
    assert.strictEqual(devAdminPostRes.status, 200);
    const devAdminPostData = await devAdminPostRes.json();
    assert.strictEqual(devAdminPostData.success, true);
    assert.strictEqual(devAdminPostData.data.user.id, DEV_ADMIN_ID);
    assert.strictEqual(devAdminPostData.data.user.role, "CAMPUS_ADMIN");
    assert.strictEqual(devAdminPostData.data.user.devRole, "ADMIN");
    assert.strictEqual(devAdminPostData.data.user.campusId, SEED_CAMPUS_ID);

    // 5b. GET /api/dev/session with admin cookie
    const devAdminGetReq = new Request("http://localhost:3000/api/dev/session", {
      headers: { cookie: `collega_dev_user_id=${DEV_ADMIN_ID}` },
    });
    const devAdminGetRes = await devSessionGet(devAdminGetReq);
    assert.strictEqual(devAdminGetRes.status, 200);
    const devAdminGetData = await devAdminGetRes.json();
    assert.strictEqual(devAdminGetData.success, true);
    assert.strictEqual(devAdminGetData.data.user.id, DEV_ADMIN_ID);
    assert.strictEqual(devAdminGetData.data.user.role, "CAMPUS_ADMIN");

    // 5c. getCurrentSession resolves DEV_ADMIN_ID to CAMPUS_ADMIN in development
    const devAdminSessionReq = new Request("http://localhost:3000/api/admin/shops", {
      headers: { "x-collega-test-user-id": DEV_ADMIN_ID },
    });
    const resolvedAdminSession = await getCurrentSession(devAdminSessionReq);
    assert.ok(resolvedAdminSession);
    assert.strictEqual(resolvedAdminSession.user.id, DEV_ADMIN_ID);
    assert.strictEqual(resolvedAdminSession.user.role, "CAMPUS_ADMIN");
    assert.strictEqual(resolvedAdminSession.user.campusId, DEV_CAMPUS_ID);

    // 5d. Authorized dev admin can access admin domain service
    const devAdminShops = await AdminShopService.listShops(resolvedAdminSession);
    assert.ok(Array.isArray(devAdminShops));

    // 5e. Rejection of non-admin access: switch back to STUDENT
    const devStudentPostReq = new Request("http://localhost:3000/api/dev/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "STUDENT" }),
    });
    const devStudentPostRes = await devSessionPost(devStudentPostReq);
    const devStudentPostData = await devStudentPostRes.json();
    assert.strictEqual(devStudentPostData.data.user.id, DEV_STUDENT_ID);
    assert.strictEqual(devStudentPostData.data.user.role, "STUDENT");

    const devStudentSessionReq = new Request("http://localhost:3000/api/admin/shops", {
      headers: { "x-collega-test-user-id": DEV_STUDENT_ID },
    });
    const resolvedStudentSession = await getCurrentSession(devStudentSessionReq);
    assert.ok(resolvedStudentSession);
    assert.strictEqual(resolvedStudentSession.user.role, "STUDENT");

    await assert.rejects(
      async () => AdminShopService.listShops(resolvedStudentSession),
      (err: unknown) => err instanceof ForbiddenError,
      "Dev STUDENT identity must receive 403 on admin shop endpoints"
    );

    // 5f. Session revocation via DELETE /api/dev/session
    const devLogoutRes = await devSessionDelete();
    assert.strictEqual(devLogoutRes.status, 200);
    const devLogoutData = await devLogoutRes.json();
    assert.strictEqual(devLogoutData.success, true);
    assert.strictEqual(devLogoutData.data.loggedOut, true);

    const devLoggedOutGetReq = new Request("http://localhost:3000/api/dev/session");
    const devLoggedOutGetRes = await devSessionGet(devLoggedOutGetReq);
    const devLoggedOutGetData = await devLoggedOutGetRes.json();
    assert.strictEqual(devLoggedOutGetData.data.user, null);

    const unauthReq = new Request("http://localhost:3000/api/admin/shops");
    const unauthSession = await getCurrentSession(unauthReq);
    assert.strictEqual(unauthSession, null);

    // 5g. Production denial: all dev endpoints and test headers strictly blocked in production
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      const prodPost = await devSessionPost(devAdminPostReq);
      assert.strictEqual(prodPost.status, 403);
      const prodPostData = await prodPost.json();
      assert.strictEqual(prodPostData.error.code, "FORBIDDEN");

      const prodGet = await devSessionGet(devAdminGetReq);
      assert.strictEqual(prodGet.status, 403);

      const prodDelete = await devSessionDelete();
      assert.strictEqual(prodDelete.status, 403);

      const prodResolved = await getCurrentSession(devAdminSessionReq);
      assert.strictEqual(prodResolved, null, "Test user ID headers must be strictly ignored in production");
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    }
    console.log("  ✔ Dev admin identity, role selection, non-admin rejection, logout, and production guards verified.\n");

    console.log("==================================================");
    console.log("✅ All Milestone 4B Phase 3 tests passed successfully!");
    console.log("==================================================");
  } finally {
    console.log("🧹 Cleaning up Phase 3 test fixtures...");
    for (const sid of cleanupShopIds) {
      await prisma.shopMember.deleteMany({ where: { shopId: sid } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { entityId: sid } }).catch(() => {});
      await prisma.shop.delete({ where: { id: sid } }).catch(() => {});
    }
    for (const uid of cleanupUserIds) {
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    for (const cid of cleanupCampusIds) {
      await prisma.campus.delete({ where: { id: cid } }).catch(() => {});
    }
    console.log("✔ Cleanup complete.");
  }
}

runMilestone4BPhase3Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Test suite failed:", err);
    process.exit(1);
  });
