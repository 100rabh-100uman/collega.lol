import { requireSession } from "@/core/auth/session";
import { apiSuccess, apiError } from "@/core/api/response";
import { prisma } from "@/core/db/prisma";

/**
 * GET /api/shops/memberships
 * Returns all shops where the authenticated user holds an active membership.
 * Strictly server-authorized: never accepts client-supplied shop IDs or roles.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession(request);

    // Super Admin has global OWNER access across campus shops
    if (session.user.role === "SUPER_ADMIN") {
      const shops = await prisma.shop.findMany({
        where: {
          ...(session.user.campusId ? { campusId: session.user.campusId } : {}),
        },
        select: {
          id: true,
          campusId: true,
          name: true,
          slug: true,
          description: true,
          location: true,
          isActive: true,
          isOpen: true,
          autoAcceptOrders: true,
        },
        orderBy: { name: "asc" },
      });

      return apiSuccess(
        shops.map((s) => ({
          ...s,
          role: "OWNER" as const,
          isActive: s.isActive,
        }))
      );
    }

    // Regular users: resolve from active shopMemberships in session context
    const activeMemberships = (session.shopMemberships || []).filter((m) => m.isActive);
    if (activeMemberships.length === 0) {
      return apiSuccess([]);
    }

    const shopIds = activeMemberships.map((m) => m.shopId);
    const shops = await prisma.shop.findMany({
      where: {
        id: { in: shopIds },
      },
      select: {
        id: true,
        campusId: true,
        name: true,
        slug: true,
        description: true,
        location: true,
        isActive: true,
        isOpen: true,
        autoAcceptOrders: true,
      },
      orderBy: { name: "asc" },
    });

    const roleMap = new Map(activeMemberships.map((m) => [m.shopId, m.role]));

    const result = shops.map((s) => ({
      ...s,
      role: roleMap.get(s.id) || "STAFF",
      isActive: s.isActive,
    }));

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
