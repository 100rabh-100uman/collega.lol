import { createHash, randomBytes, randomInt } from "node:crypto";
import { prisma } from "@/core/db/prisma";
import { assertAuthenticated, assertShopAccess } from "@/core/auth/rbac";
import type { SessionContext } from "@/core/types/auth";
import { ValidationError, NotFoundError } from "@/core/errors";

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

export class StaffAccessService {
  /**
   * Generates a new staff invitation with an unguessable token and unique 10-digit PIN.
   * Strictly requires OWNER or MANAGER role for the specified shop.
   */
  static async generateStaffInvitation(
    session: SessionContext,
    shopId: string,
    expiryMinutes = 15
  ) {
    assertAuthenticated(session);
    assertShopAccess(session, shopId, ["OWNER", "MANAGER"]);

    const rawToken = randomBytes(24).toString("hex");
    // Generate 10-digit cryptographically random numeric code (1,000,000,000 to 9,999,999,999)
    const rawCode = randomInt(1000000000, 10000000000).toString();

    const tokenHash = sha256(rawToken);
    const codeHash = sha256(rawCode);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const invitation = await prisma.staffInvitation.create({
      data: {
        shopId,
        createdById: session.user.id,
        tokenHash,
        codeHash,
        expiresAt,
      },
      include: {
        shop: {
          select: { id: true, name: true },
        },
      },
    });

    return {
      id: invitation.id,
      shopId,
      shopName: invitation.shop.name,
      invitationToken: rawToken,
      code: rawCode,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Lists connected active staff sessions and pending invitations for the manager dashboard.
   * Strictly counts only active, non-expired, non-revoked redeemed staff sessions.
   */
  static async listStaffSessions(session: SessionContext, shopId: string) {
    assertAuthenticated(session);
    assertShopAccess(session, shopId, ["OWNER", "MANAGER"]);

    const now = new Date();

    const [activeSessions, pendingInvitations] = await Promise.all([
      prisma.staffSession.findMany({
        where: {
          shopId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          shopId: true,
          staffLabel: true,
          createdAt: true,
          expiresAt: true,
          lastActiveAt: true,
        },
      }),
      prisma.staffInvitation.findMany({
        where: {
          shopId,
          redeemedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          shopId: true,
          expiresAt: true,
          createdAt: true,
          attempts: true,
        },
      }),
    ]);

    return {
      activeStaffCount: activeSessions.length,
      sessions: activeSessions,
      pendingInvitations,
    };
  }

  /**
   * Immediately revokes an active staff session.
   * Subsequent API requests with this staff session will be rejected immediately.
   */
  static async revokeStaffSession(
    session: SessionContext,
    shopId: string,
    sessionId: string
  ) {
    assertAuthenticated(session);
    assertShopAccess(session, shopId, ["OWNER", "MANAGER"]);

    const targetSession = await prisma.staffSession.findUnique({
      where: { id: sessionId },
    });

    if (!targetSession || targetSession.shopId !== shopId) {
      throw new NotFoundError("Staff session", sessionId);
    }

    const updated = await prisma.staffSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return { success: true, sessionId: updated.id, revokedAt: updated.revokedAt };
  }

  /**
   * Revokes a pending staff invitation before redemption.
   */
  static async revokeStaffInvitation(
    session: SessionContext,
    shopId: string,
    invitationId: string
  ) {
    assertAuthenticated(session);
    assertShopAccess(session, shopId, ["OWNER", "MANAGER"]);

    const targetInvitation = await prisma.staffInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!targetInvitation || targetInvitation.shopId !== shopId) {
      throw new NotFoundError("Staff invitation", invitationId);
    }

    const updated = await prisma.staffInvitation.update({
      where: { id: invitationId },
      data: { revokedAt: new Date() },
    });

    return { success: true, invitationId: updated.id, revokedAt: updated.revokedAt };
  }

  /**
   * Atomically redeems an invitation token and 10-digit PIN.
   * Enforces single-use redemption, expiry checks, and rate-limiting against PIN guessing.
   */
  static async redeemStaffInvitation(rawToken: string, rawCode: string) {
    if (!rawToken || typeof rawToken !== "string" || !rawToken.trim()) {
      throw new ValidationError("Invitation token is required");
    }

    const cleanCode = (rawCode || "").replace(/\D/g, "");
    if (cleanCode.length !== 10) {
      throw new ValidationError("Please enter the complete 10-digit verification code");
    }

    const tokenHash = sha256(rawToken.trim());
    const invitation = await prisma.staffInvitation.findUnique({
      where: { tokenHash },
      include: {
        shop: {
          select: { id: true, name: true, campusId: true, isOpen: true },
        },
      },
    });

    const now = new Date();
    if (!invitation || invitation.revokedAt !== null || invitation.redeemedAt !== null || invitation.expiresAt < now) {
      throw new ValidationError("Invalid or expired staff invitation link");
    }

    // Rate-limiting protection: max 5 failed attempts per invitation
    if (invitation.attempts >= 5) {
      await prisma.staffInvitation.update({
        where: { id: invitation.id },
        data: { revokedAt: now },
      });
      throw new ValidationError("Too many incorrect attempts. This staff invitation has been revoked.");
    }

    const codeHash = sha256(cleanCode);
    if (codeHash !== invitation.codeHash) {
      const updated = await prisma.staffInvitation.update({
        where: { id: invitation.id },
        data: {
          attempts: { increment: 1 },
          ...(invitation.attempts + 1 >= 5 ? { revokedAt: now } : {}),
        },
      });

      if (updated.attempts >= 5) {
        throw new ValidationError("Too many incorrect attempts. This staff invitation has been revoked.");
      }

      const remainingAttempts = Math.max(0, 5 - updated.attempts);
      throw new ValidationError(
        `Invalid 10-digit code. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`
      );
    }

    // Atomic redemption and session generation within transaction
    const result = await prisma.$transaction(async (tx) => {
      const freshInv = await tx.staffInvitation.findUnique({
        where: { id: invitation.id },
      });

      if (!freshInv || freshInv.redeemedAt !== null || freshInv.revokedAt !== null || freshInv.expiresAt < now) {
        throw new ValidationError("Invitation has already been redeemed or expired");
      }

      await tx.staffInvitation.update({
        where: { id: freshInv.id },
        data: { redeemedAt: now },
      });

      const rawSessionToken = randomBytes(32).toString("hex");
      const sessionTokenHash = sha256(rawSessionToken);
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8-hour shift expiry

      const activeCount = await tx.staffSession.count({
        where: {
          shopId: freshInv.shopId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      });

      const staffLabel = `Counter Staff #${activeCount + 1}`;

      const newSession = await tx.staffSession.create({
        data: {
          shopId: freshInv.shopId,
          staffLabel,
          sessionTokenHash,
          invitationId: freshInv.id,
          expiresAt,
        },
      });

      return {
        sessionToken: rawSessionToken,
        staffLabel: newSession.staffLabel,
        sessionId: newSession.id,
        expiresAt: newSession.expiresAt,
      };
    });

    return {
      sessionToken: result.sessionToken,
      sessionId: result.sessionId,
      staffLabel: result.staffLabel,
      shopId: invitation.shop.id,
      shopName: invitation.shop.name,
      expiresAt: result.expiresAt,
    };
  }

  /**
   * Validates a bearer or cookie staff session token against the database.
   * Returns null if token is missing, expired, or revoked.
   */
  static async validateStaffSessionToken(rawSessionToken: string) {
    if (!rawSessionToken || typeof rawSessionToken !== "string") {
      return null;
    }

    const sessionTokenHash = sha256(rawSessionToken);
    const now = new Date();

    const session = await prisma.staffSession.findUnique({
      where: { sessionTokenHash },
      include: {
        shop: {
          select: { id: true, name: true, campusId: true, isOpen: true },
        },
      },
    });

    if (!session || session.revokedAt !== null || session.expiresAt < now) {
      return null;
    }

    // Touch lastActiveAt non-blockingly
    prisma.staffSession
      .updateMany({
        where: { id: session.id, revokedAt: null },
        data: { lastActiveAt: now },
      })
      .catch(() => {});

    return {
      id: session.id,
      shopId: session.shopId,
      staffLabel: session.staffLabel,
      shopName: session.shop.name,
      campusId: session.shop.campusId,
      expiresAt: session.expiresAt,
    };
  }
}
