import { createServerSupabaseClient } from "../supabase/server";
import { prisma } from "../db/prisma";
import type { SessionContext } from "../types/auth";
import { UnauthorizedError } from "../errors";

/**
 * Retrieves the currently authenticated session by validating the Supabase JWT
 * cryptographically on the server and resolving the internal Prisma user record
 * and active shop memberships.
 *
 * Never trusts client-supplied user or shop headers.
 * Returns null if the user is unauthenticated or deactivated.
 */
export async function getCurrentSession(): Promise<SessionContext | null> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // auth.getUser() cryptographically verifies the token on the server
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser || !authUser.email) {
      return null;
    }

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

    if (!dbUser.isActive) {
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
  } catch {
    // If Supabase is unconfigured (e.g. during build or static evaluation), gracefully return null
    return null;
  }
}

/**
 * Convenience helper for Server Actions and protected Route Handlers.
 * Throws UnauthorizedError if no valid session is found.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await getCurrentSession();
  if (!session) {
    throw new UnauthorizedError("You must be logged in to perform this action");
  }
  return session;
}
