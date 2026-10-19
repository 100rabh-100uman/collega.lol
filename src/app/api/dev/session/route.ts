import { cookies } from "next/headers";
import { prisma } from "@/core/db/prisma";
import { apiSuccess, apiError } from "@/core/api/response";
import { ForbiddenError } from "@/core/errors";
import { SEED_CAMPUS_ID, SEED_SHOP_ID } from "../../../../../prisma/seed";

import { DEV_STUDENT_ID, DEV_STAFF_ID, DEV_MANAGER_ID } from "@/core/auth/session";

const DEV_STUDENT_EMAIL = "student.dev@collega.local";
const DEV_STAFF_EMAIL = "staff.dev@collega.local";
const DEV_MANAGER_EMAIL = "manager.dev@collega.local";

/**
 * DEV ONLY: Provides an isolated student or shop staff/manager session cookie for local browser testing.
 * Strictly blocked in production.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return apiError(new ForbiddenError("Dev session is strictly disabled in production"));
  }

  try {
    let body: { role?: "STUDENT" | "STAFF" | "MANAGER" } = {};
    try {
      body = await request.json();
    } catch {
      // Default to STUDENT if no body
    }

    let devUserId = DEV_STUDENT_ID;
    let devEmail = DEV_STUDENT_EMAIL;
    let assignedRole: "STUDENT" | "STAFF" | "MANAGER" = "STUDENT";

    if (body.role === "STAFF") {
      devUserId = DEV_STAFF_ID;
      devEmail = DEV_STAFF_EMAIL;
      assignedRole = "STAFF";
    } else if (body.role === "MANAGER") {
      devUserId = DEV_MANAGER_ID;
      devEmail = DEV_MANAGER_EMAIL;
      assignedRole = "MANAGER";
    }

    try {
      const cookieStore = await cookies();
      cookieStore.set("collega_dev_user_id", devUserId, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      cookieStore.delete("collega_staff_token");
    } catch {
      // Graceful fallback if called outside Next.js request context (e.g. in unit/integration tests)
    }

    return apiSuccess({
      user: {
        id: devUserId,
        email: devEmail,
        role: "STUDENT",
        devRole: assignedRole,
        campusId: SEED_CAMPUS_ID,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function GET(request?: Request) {
  if (process.env.NODE_ENV === "production") {
    return apiError(new ForbiddenError("Dev session is strictly disabled in production"));
  }

  try {
    let devUserId: string | undefined;
    try {
      const cookieStore = await cookies();
      devUserId = cookieStore.get("collega_dev_user_id")?.value;
    } catch {
      // Graceful fallback if called outside Next.js request context (e.g. in tests)
      const cookieHeader = request?.headers.get("cookie") || "";
      const match = cookieHeader.match(/collega_dev_user_id=([^;]+)/);
      devUserId = match ? match[1] : undefined;
    }

    if (devUserId === DEV_STUDENT_ID) {
      return apiSuccess({
        user: {
          id: DEV_STUDENT_ID,
          email: DEV_STUDENT_EMAIL,
          role: "STUDENT",
          devRole: "STUDENT",
          campusId: SEED_CAMPUS_ID,
          isActive: true,
          shopMemberships: [],
          campus: {
            id: SEED_CAMPUS_ID,
            name: "Apex Institute of Technology — North Campus",
            slug: "apex-north",
          },
        },
      });
    }

    if (devUserId === DEV_STAFF_ID) {
      return apiSuccess({
        user: {
          id: DEV_STAFF_ID,
          email: DEV_STAFF_EMAIL,
          role: "STUDENT",
          devRole: "STAFF",
          campusId: SEED_CAMPUS_ID,
          isActive: true,
          shopMemberships: [
            {
              shopId: "00000002-0000-4000-8000-000000000001",
              role: "STAFF",
              isActive: true,
            },
          ],
          campus: {
            id: SEED_CAMPUS_ID,
            name: "Apex Institute of Technology — North Campus",
            slug: "apex-north",
          },
        },
      });
    }

    if (devUserId === DEV_MANAGER_ID) {
      let memberships: Array<{ shopId: string; role: "MANAGER"; isActive: boolean }> = [];
      try {
        const devCampusShops = await prisma.shop.findMany({
          where: { campusId: SEED_CAMPUS_ID },
          select: { id: true },
        });
        memberships = devCampusShops.map((s) => ({
          shopId: s.id,
          role: "MANAGER" as const,
          isActive: true,
        }));
      } catch {
        // Fallback if DB query fails
      }

      if (!memberships.some((m) => m.shopId === SEED_SHOP_ID)) {
        memberships.push({
          shopId: SEED_SHOP_ID,
          role: "MANAGER",
          isActive: true,
        });
      }

      return apiSuccess({
        user: {
          id: DEV_MANAGER_ID,
          email: DEV_MANAGER_EMAIL,
          role: "STUDENT",
          devRole: "MANAGER",
          campusId: SEED_CAMPUS_ID,
          isActive: true,
          shopMemberships: memberships,
          campus: {
            id: SEED_CAMPUS_ID,
            name: "Apex Institute of Technology — North Campus",
            slug: "apex-north",
          },
        },
      });
    }

    if (!devUserId) {
      return apiSuccess({ user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: devUserId },
      select: {
        id: true,
        email: true,
        role: true,
        campusId: true,
        isActive: true,
        campus: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return apiSuccess({ user });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE() {
  if (process.env.NODE_ENV === "production") {
    return apiError(new ForbiddenError("Dev session is strictly disabled in production"));
  }

  const cookieStore = await cookies();
  cookieStore.delete("collega_dev_user_id");
  return apiSuccess({ loggedOut: true });
}
