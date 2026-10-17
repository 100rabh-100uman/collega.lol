import type { SessionContext, ShopMembershipContext } from "../types/auth";
import type { UserRole, ShopRole } from "@prisma/client";
import { UnauthorizedError, ForbiddenError } from "../errors";

/**
 * Asserts that a valid session exists. Throws UnauthorizedError if null or undefined.
 */
export function assertAuthenticated(
  session: SessionContext | null | undefined
): asserts session is SessionContext {
  if (!session || !session.user || !session.user.isActive) {
    throw new UnauthorizedError("Authentication required or account is deactivated");
  }
}

/**
 * Asserts that the authenticated user belongs to the requested campus.
 */
export function assertCampusAccess(
  session: SessionContext,
  campusId: string
): void {
  assertAuthenticated(session);
  if (session.user.role === "SUPER_ADMIN") {
    return; // Super admin has cross-campus access
  }
  if (!session.user.campusId || session.user.campusId !== campusId) {
    throw new ForbiddenError("Access denied: User does not belong to this campus");
  }
}

/**
 * Asserts that the authenticated user possesses one of the allowed global roles.
 */
export function assertUserRole(
  session: SessionContext,
  allowedRoles: UserRole[]
): void {
  assertAuthenticated(session);
  if (session.user.role === "SUPER_ADMIN") {
    return;
  }
  if (!allowedRoles.includes(session.user.role)) {
    throw new ForbiddenError(
      `Access denied: Required role (${allowedRoles.join(", ")}) not held by user`
    );
  }
}

/**
 * Asserts that the user is an active member of the specified shop with the necessary role.
 * Never trust a client-supplied shop ID without verifying membership.
 */
export function assertShopAccess(
  session: SessionContext,
  shopId: string,
  allowedShopRoles: ShopRole[] = ["OWNER", "MANAGER", "STAFF"]
): ShopMembershipContext {
  assertAuthenticated(session);

  // Super admins have elevated administrative access
  if (session.user.role === "SUPER_ADMIN") {
    return {
      shopId,
      role: "OWNER",
      isActive: true,
    };
  }

  const membership = session.shopMemberships.find(
    (m) => m.shopId === shopId && m.isActive
  );

  if (!membership) {
    throw new ForbiddenError("Access denied: You are not authorized for this shop");
  }

  if (!allowedShopRoles.includes(membership.role)) {
    throw new ForbiddenError(
      `Access denied: Action requires one of the following shop roles: ${allowedShopRoles.join(", ")}`
    );
  }

  return membership;
}
