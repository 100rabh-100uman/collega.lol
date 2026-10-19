import { cookies } from "next/headers";
import { createServerSupabaseClient } from "../supabase/server";
import { prisma } from "../db/prisma";
import type { SessionContext } from "../types/auth";
import { UnauthorizedError } from "../errors";

import { StaffAccessService } from "@/modules/smart-ordering/services/staff-access-service";

export const DEV_STUDENT_ID = "00000000-0000-4000-a000-000000000001";
export const DEV_STAFF_ID = "00000000-0000-4000-a000-000000000002";
export const DEV_MANAGER_ID = "00000000-0000-4000-a000-000000000003";

export const DEV_CAMPUS_ID = "00000001-0000-4000-8000-000000000001";
export const DEV_DEFAULT_SHOP_ID = "00000002-0000-4000-8000-000000000001";

export const RECOGNIZED_DEV_IDS = [
  DEV_STUDENT_ID,
  DEV_STAFF_ID,
  DEV_MANAGER_ID,
] as const;

export type RecognizedDevId = (typeof RECOGNIZED_DEV_IDS)[number];

export function isRecognizedDevId(id: string): id is RecognizedDevId {
  return (RECOGNIZED_DEV_IDS as readonly string[]).includes(id);
}

/**
 * Retrieves the currently authenticated session by validating:
 * 1. An active, server-persisted mobile staff session token (Bearer or cookie), OR
 * 2. Non-production development testing identities, OR
 * 3. The Supabase JWT verified cryptographically on the server.
 *
 * Never trusts client-supplied user or shop headers.
 * Returns null if the user is unauthenticated or deactivated.
 */
export async function getCurrentSession(request?: Request): Promise<SessionContext | null> {
  try {
    // 1. Explicit Staff Request Header (from API clients, test fixtures, or staff app)
    let explicitStaffToken: string | undefined;
    if (request) {
      explicitStaffToken = request.headers.get("x-collega-staff-token") || undefined;
      const authHeader = request.headers.get("authorization");
      if (!explicitStaffToken && authHeader?.startsWith("Bearer ")) {
        const candidate = authHeader.slice(7).trim();
        // 64-char hex string is a staff session token
        if (candidate.length === 64) {
          explicitStaffToken = candidate;
        }
      }
    }

    if (explicitStaffToken) {
      const validStaffSession = await StaffAccessService.validateStaffSessionToken(explicitStaffToken);
      if (validStaffSession) {
        return {
          user: {
            id: `staff_${validStaffSession.id}`,
            email: `staff_${validStaffSession.id.slice(0, 8)}@collega.internal`,
            role: "STUDENT",
            campusId: validStaffSession.campusId,
            isActive: true,
          },
          shopMemberships: [
            {
              shopId: validStaffSession.shopId,
              role: "STAFF",
              isActive: true,
            },
          ],
        };
      }
    }
    // Non-production test session resolution: allows integration tests and browser dev to run without creating fake Supabase Auth accounts
    if (process.env.NODE_ENV !== "production") {
      let testUserId = request?.headers.get("x-collega-test-user-id");
      if (!testUserId) {
        try {
          const cookieStore = await cookies();
          testUserId = cookieStore.get("collega_dev_user_id")?.value;
        } catch {
          // Graceful fallback if called outside request context
        }
      }

      if (testUserId === DEV_STUDENT_ID) {
        return {
          user: {
            id: DEV_STUDENT_ID,
            email: "student.dev@collega.local",
            role: "STUDENT",
            campusId: DEV_CAMPUS_ID,
            isActive: true,
          },
          shopMemberships: [],
        };
      }

      if (testUserId === DEV_STAFF_ID) {
        return {
          user: {
            id: DEV_STAFF_ID,
            email: "staff.dev@collega.local",
            role: "STUDENT",
            campusId: DEV_CAMPUS_ID,
            isActive: true,
          },
          shopMemberships: [
            {
              shopId: DEV_DEFAULT_SHOP_ID,
              role: "STAFF",
              isActive: true,
            },
          ],
        };
      }

      if (testUserId === DEV_MANAGER_ID) {
        // Non-production development mode only: grant the designated development manager
        // access to all shops within the designated development campus derived from trusted DB records.
        let memberships: Array<{ shopId: string; role: "MANAGER"; isActive: boolean }> = [];
        try {
          const devCampusShops = await prisma.shop.findMany({
            where: { campusId: DEV_CAMPUS_ID },
            select: { id: true },
          });
          memberships = devCampusShops.map((s) => ({
            shopId: s.id,
            role: "MANAGER" as const,
            isActive: true,
          }));
        } catch {
          // Graceful fallback if DB query fails or in standalone unit tests
        }

        if (!memberships.some((m) => m.shopId === DEV_DEFAULT_SHOP_ID)) {
          memberships.push({
            shopId: DEV_DEFAULT_SHOP_ID,
            role: "MANAGER",
            isActive: true,
          });
        }

        return {
          user: {
            id: DEV_MANAGER_ID,
            email: "manager.dev@collega.local",
            role: "STUDENT",
            campusId: DEV_CAMPUS_ID,
            isActive: true,
          },
          shopMemberships: memberships,
        };
      }

      if (testUserId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: testUserId },
          include: {
            shopMemberships: {
              where: { isActive: true },
              select: { shopId: true, role: true, isActive: true },
            },
          },
        });

        if (!dbUser || !dbUser.isActive) {
          return null;
        }

        return {
          user: {
            id: dbUser.id,
            email: dbUser.email,
            role: dbUser.role,
            campusId: dbUser.campusId,
            isActive: dbUser.isActive,
          },
          shopMemberships: dbUser.shopMemberships.map((m) => ({
            shopId: m.shopId,
            role: m.role,
            isActive: m.isActive,
          })),
        };
      }
    }

    try {
      const supabase = await createServerSupabaseClient();
      
      // auth.getUser() cryptographically verifies the token on the server
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();

      if (!error && authUser && authUser.email) {
        // Retrieve corresponding internal user and authorized shop memberships
        let dbUser = await prisma.user.findUnique({
          where: { id: authUser.id },
          include: {
            shopMemberships: {
              where: { isActive: true },
              select: { shopId: true, role: true, isActive: true },
            },
          },
        });

        // Auto-provision student profile on first verified Supabase login if not yet existing
        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              id: authUser.id,
              email: authUser.email,
              role: "STUDENT",
            },
            include: {
              shopMemberships: {
                where: { isActive: true },
                select: { shopId: true, role: true, isActive: true },
              },
            },
          });
        }

        if (dbUser && dbUser.isActive) {
          return {
            user: {
              id: dbUser.id,
              email: dbUser.email,
              role: dbUser.role,
              campusId: dbUser.campusId,
              isActive: dbUser.isActive,
            },
            shopMemberships: dbUser.shopMemberships.map((m) => ({
              shopId: m.shopId,
              role: m.role,
              isActive: m.isActive,
            })),
          };
        }
      }
    } catch {
      // Supabase unconfigured or error
    }

    // 4. Ephemeral Mobile Counter Staff Cookie (for unauthenticated counter staff phones/kiosks)
    try {
      const cookieStore = await cookies();
      const staffCookieToken = cookieStore.get("collega_staff_token")?.value;
      if (staffCookieToken) {
        const validStaffSession = await StaffAccessService.validateStaffSessionToken(staffCookieToken);
        if (validStaffSession) {
          return {
            user: {
              id: `staff_${validStaffSession.id}`,
              email: `staff_${validStaffSession.id.slice(0, 8)}@collega.internal`,
              role: "STUDENT",
              campusId: validStaffSession.campusId,
              isActive: true,
            },
            shopMemberships: [
              {
                shopId: validStaffSession.shopId,
                role: "STAFF",
                isActive: true,
              },
            ],
          };
        }
      }
    } catch {
      // Ignored outside request context
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Convenience helper for Server Actions and protected Route Handlers.
 * Throws UnauthorizedError if no valid session is found.
 */
export async function requireSession(request?: Request): Promise<SessionContext> {
  const session = await getCurrentSession(request);
  if (!session) {
    throw new UnauthorizedError("You must be logged in to perform this action");
  }
  return session;
}
