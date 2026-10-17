import assert from "node:assert/strict";
import {
  assertAuthenticated,
  assertCampusAccess,
  assertUserRole,
  assertShopAccess,
} from "../src/core/auth/rbac";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../src/core/errors";
import {
  checkDatabaseReadiness,
  checkSupabaseReadiness,
} from "../src/core/config/env";
import { ok, err } from "../src/core/types/result";
import type { SessionContext } from "../src/core/types/auth";

console.log("=== Running Core Auth & Config Readiness Tests ===");

// 1. Environment Readiness Checks
{
  const dbStatus = checkDatabaseReadiness();
  assert.equal(typeof dbStatus.isConfigured, "boolean");
  assert.equal(typeof dbStatus.isPlaceholder, "boolean");
  assert.ok(dbStatus.message.length > 0);
  // Ensure message does not print database connection password or full URI
  assert.equal(dbStatus.message.includes("postgres:postgres"), false);

  const supabaseStatus = checkSupabaseReadiness();
  assert.equal(typeof supabaseStatus.isConfigured, "boolean");
  assert.equal(typeof supabaseStatus.isPlaceholder, "boolean");
  assert.ok(supabaseStatus.message.length > 0);
  console.log("✔ Environment readiness verification passed (no secrets leaked).");
}

// 2. Error Classes
{
  const unauth = new UnauthorizedError();
  assert.equal(unauth.statusCode, 401);
  assert.equal(unauth.code, "UNAUTHORIZED");

  const forbidden = new ForbiddenError();
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.code, "FORBIDDEN");

  const notFound = new NotFoundError("Order", "ord-123");
  assert.equal(notFound.statusCode, 404);
  assert.equal(notFound.message, "Order with identifier 'ord-123' was not found");

  const valError = new ValidationError("Invalid inputs", { field: ["Required"] });
  assert.equal(valError.statusCode, 400);
  assert.deepEqual(valError.errors, { field: ["Required"] });

  const conflict = new ConflictError("Resource already exists");
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.code, "CONFLICT");

  console.log("✔ Domain error classes passed.");
}

// 3. Result Type Helpers
{
  const successRes = ok({ id: "test" });
  assert.equal(successRes.success, true);
  if (successRes.success) {
    assert.equal(successRes.data.id, "test");
  }

  const failRes = err(new Error("Failed"));
  assert.equal(failRes.success, false);
  if (!failRes.success) {
    assert.equal(failRes.error.message, "Failed");
  }
  console.log("✔ Result type helpers passed.");
}

// Mock Active Student Session
const mockStudentSession: SessionContext = {
  user: {
    id: "user-uuid-1",
    email: "student@campus.edu",
    role: "STUDENT",
    campusId: "campus-alpha",
    isActive: true,
  },
  shopMemberships: [],
};

// Mock Shop Manager Session
const mockManagerSession: SessionContext = {
  user: {
    id: "user-uuid-2",
    email: "canteen-manager@campus.edu",
    role: "STUDENT",
    campusId: "campus-alpha",
    isActive: true,
  },
  shopMemberships: [
    {
      shopId: "shop-canteen-1",
      role: "MANAGER",
      isActive: true,
    },
  ],
};

// Mock Super Admin Session
const mockAdminSession: SessionContext = {
  user: {
    id: "user-uuid-admin",
    email: "admin@collega.lol",
    role: "SUPER_ADMIN",
    campusId: null,
    isActive: true,
  },
  shopMemberships: [],
};

// 4. assertAuthenticated
{
  assert.doesNotThrow(() => assertAuthenticated(mockStudentSession));
  assert.throws(() => assertAuthenticated(null), UnauthorizedError);
  assert.throws(
    () =>
      assertAuthenticated({
        ...mockStudentSession,
        user: { ...mockStudentSession.user, isActive: false },
      }),
    UnauthorizedError
  );
  console.log("✔ assertAuthenticated guards passed.");
}

// 5. assertCampusAccess
{
  assert.doesNotThrow(() => assertCampusAccess(mockStudentSession, "campus-alpha"));
  assert.throws(
    () => assertCampusAccess(mockStudentSession, "campus-beta"),
    ForbiddenError
  );
  // Super admin can access any campus
  assert.doesNotThrow(() => assertCampusAccess(mockAdminSession, "campus-beta"));
  console.log("✔ assertCampusAccess guards passed.");
}

// 6. assertUserRole
{
  assert.doesNotThrow(() => assertUserRole(mockStudentSession, ["STUDENT"]));
  assert.throws(
    () => assertUserRole(mockStudentSession, ["CAMPUS_ADMIN"]),
    ForbiddenError
  );
  // Super admin bypasses role restriction
  assert.doesNotThrow(() => assertUserRole(mockAdminSession, ["CAMPUS_ADMIN"]));
  console.log("✔ assertUserRole guards passed.");
}

// 7. assertShopAccess (Never trust client-provided shop IDs)
{
  // Manager accessing their authorized shop
  const membership = assertShopAccess(mockManagerSession, "shop-canteen-1");
  assert.equal(membership.shopId, "shop-canteen-1");
  assert.equal(membership.role, "MANAGER");

  // Manager attempting to access an unauthorized shop
  assert.throws(
    () => assertShopAccess(mockManagerSession, "shop-canteen-2"),
    ForbiddenError
  );

  // Student with no shop memberships attempting to access shop management
  assert.throws(
    () => assertShopAccess(mockStudentSession, "shop-canteen-1"),
    ForbiddenError
  );

  // Staff role constraint check (requiring OWNER)
  assert.throws(
    () => assertShopAccess(mockManagerSession, "shop-canteen-1", ["OWNER"]),
    ForbiddenError
  );

  // Super admin accessing shop
  const adminAccess = assertShopAccess(mockAdminSession, "shop-canteen-99");
  assert.equal(adminAccess.role, "OWNER");

  console.log("✔ assertShopAccess tenant guards passed.");
}

console.log("=== All Core Auth & Config tests passed successfully! ===");
