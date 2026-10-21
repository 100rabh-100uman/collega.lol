import { Prisma } from "@prisma/client";
import { prisma } from "@/core/db/prisma";
import { assertAuthenticated, assertCampusAccess, assertUserRole } from "@/core/auth/rbac";
import { AuditService } from "@/core/audit";
import type { SessionContext } from "@/core/types/auth";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  ForbiddenError,
} from "@/core/errors";
import {
  createShopInputSchema,
  updateShopInputSchema,
  assignShopMemberInputSchema,
  type CreateShopInput,
  type UpdateShopInput,
  type AssignShopMemberInput,
} from "../validation/admin-shop.schema";

export class AdminShopService {
  /**
   * Creates a new shop under an authorized campus.
   * Strictly requires SUPER_ADMIN or CAMPUS_ADMIN.
   * Enforces that CAMPUS_ADMIN can only create shops in their own campus.
   */
  static async createShop(session: SessionContext, rawInput: CreateShopInput) {
    assertAuthenticated(session);
    assertUserRole(session, ["CAMPUS_ADMIN", "SUPER_ADMIN"]);
    const input = createShopInputSchema.parse(rawInput);

    // Enforce campus boundary: CAMPUS_ADMIN cannot provision shops outside their campus
    assertCampusAccess(session, input.campusId);

    // Verify campus exists and is active
    const campus = await prisma.campus.findUnique({
      where: { id: input.campusId },
      select: { id: true, isActive: true },
    });

    if (!campus || !campus.isActive) {
      throw new NotFoundError("Active Campus", input.campusId);
    }

    // Check slug uniqueness within this campus
    const existingSlug = await prisma.shop.findUnique({
      where: {
        campusId_slug: {
          campusId: input.campusId,
          slug: input.slug,
        },
      },
    });

    if (existingSlug) {
      throw new ConflictError(
        `A shop with slug '${input.slug}' already exists in this campus`
      );
    }

    return await prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          campusId: input.campusId,
          name: input.name,
          slug: input.slug,
          description: input.description,
          location: input.location,
          autoAcceptOrders: input.autoAcceptOrders,
          isOpen: input.isOpen,
          isActive: input.isActive,
          logoUrl: input.logoUrl,
          bannerUrl: input.bannerUrl,
        },
      });

      await AuditService.record(
        {
          actorId: session.user.id,
          action: "SHOP_CREATED",
          entity: "Shop",
          entityId: shop.id,
          metadata: {
            campusId: shop.campusId,
            name: shop.name,
            slug: shop.slug,
            location: shop.location,
            isActive: shop.isActive,
            isOpen: shop.isOpen,
            autoAcceptOrders: shop.autoAcceptOrders,
          },
        },
        tx
      );

      // Bootstrap initial owner if provided
      if (input.initialOwnerUserId) {
        const targetUser = await tx.user.findUnique({
          where: { id: input.initialOwnerUserId },
          select: { id: true, email: true, campusId: true, isActive: true },
        });

        if (!targetUser) {
          throw new NotFoundError("User", input.initialOwnerUserId);
        }

        if (!targetUser.isActive) {
          throw new ValidationError("Cannot assign membership to an inactive user account");
        }

        if (targetUser.campusId !== input.campusId) {
          throw new ForbiddenError("Cannot assign initial owner: User belongs to a different campus");
        }

        const initialOwner = await tx.shopMember.create({
          data: {
            shopId: shop.id,
            userId: targetUser.id,
            role: "OWNER",
            isActive: true,
          },
        });

        await AuditService.record(
          {
            actorId: session.user.id,
            action: "SHOP_MEMBER_ASSIGNED",
            entity: "ShopMember",
            entityId: initialOwner.id,
            metadata: {
              shopId: shop.id,
              userId: targetUser.id,
              role: "OWNER",
              isInitialOwner: true,
            },
          },
          tx
        );
      }

      return shop;
    });
  }

  /**
   * Lists shops for administration.
   * Strictly requires SUPER_ADMIN or CAMPUS_ADMIN.
   * CAMPUS_ADMIN can only list shops for their own campus.
   * SUPER_ADMIN can list across campuses or filter by campusId.
   * Includes administratively inactive shops.
   */
  static async listShops(
    session: SessionContext,
    options?: {
      campusId?: string;
      search?: string;
      status?: "all" | "active" | "inactive";
    }
  ) {
    assertAuthenticated(session);
    assertUserRole(session, ["CAMPUS_ADMIN", "SUPER_ADMIN"]);

    let targetCampusId: string | undefined;
    if (session.user.role === "CAMPUS_ADMIN") {
      targetCampusId = session.user.campusId ?? undefined;
      if (!targetCampusId) {
        throw new ForbiddenError("Campus admin has no assigned campus");
      }
      if (options?.campusId && options.campusId !== targetCampusId) {
        throw new ForbiddenError("Campus admin cannot access shops outside their assigned campus");
      }
    } else {
      targetCampusId = options?.campusId;
    }

    const where: Prisma.ShopWhereInput = {};
    if (targetCampusId) {
      where.campusId = targetCampusId;
    }

    if (options?.status === "active") {
      where.isActive = true;
    } else if (options?.status === "inactive") {
      where.isActive = false;
    }

    if (options?.search) {
      const q = options.search.trim();
      if (q) {
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
        ];
      }
    }

    const shops = await prisma.shop.findMany({
      where,
      include: {
        campus: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        staff: {
          where: { role: "OWNER", isActive: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            staff: { where: { isActive: true } },
            orders: true,
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return shops.map((s) => ({
      ...s,
      members: s.staff,
      _count: {
        members: s._count.staff,
        orders: s._count.orders,
      },
    }));
  }

  /**
   * Retrieves administrative shop details by shopId regardless of active status.
   * Strictly requires SUPER_ADMIN or CAMPUS_ADMIN.
   * Enforces campus boundaries.
   */
  static async getShopById(session: SessionContext, shopId: string) {
    assertAuthenticated(session);
    assertUserRole(session, ["CAMPUS_ADMIN", "SUPER_ADMIN"]);

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        campus: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        staff: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                profile: {
                  select: {
                    fullName: true,
                    phone: true,
                  },
                },
              },
            },
          },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        },
        _count: {
          select: {
            staff: { where: { isActive: true } },
            orders: true,
            products: true,
          },
        },
      },
    });

    if (!shop) {
      throw new NotFoundError("Shop", shopId);
    }

    assertCampusAccess(session, shop.campusId);

    return {
      ...shop,
      members: shop.staff,
      _count: {
        members: shop._count.staff,
        orders: shop._count.orders,
        products: shop._count.products,
      },
    };
  }

  /**
   * Updates shop metadata, configuration, or administrative activation.
   * Strictly requires SUPER_ADMIN or CAMPUS_ADMIN.
   * Preserves omitted fields; validates slug uniqueness if changed.
   */
  static async updateShop(
    session: SessionContext,
    shopId: string,
    rawInput: UpdateShopInput
  ) {
    assertAuthenticated(session);
    assertUserRole(session, ["CAMPUS_ADMIN", "SUPER_ADMIN"]);
    const input = updateShopInputSchema.parse(rawInput);

    const existingShop = await prisma.shop.findUnique({
      where: { id: shopId },
    });

    if (!existingShop) {
      throw new NotFoundError("Shop", shopId);
    }

    // Enforce campus boundary derived from trusted database record
    assertCampusAccess(session, existingShop.campusId);

    // Verify slug uniqueness if slug is being updated
    if (input.slug && input.slug !== existingShop.slug) {
      const duplicateSlug = await prisma.shop.findUnique({
        where: {
          campusId_slug: {
            campusId: existingShop.campusId,
            slug: input.slug,
          },
        },
      });

      if (duplicateSlug) {
        throw new ConflictError(
          `A shop with slug '${input.slug}' already exists in this campus`
        );
      }
    }

    const data: Prisma.ShopUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.description !== undefined) data.description = input.description;
    if (input.location !== undefined) data.location = input.location;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.isOpen !== undefined) data.isOpen = input.isOpen;
    if (input.autoAcceptOrders !== undefined) data.autoAcceptOrders = input.autoAcceptOrders;
    if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
    if (input.bannerUrl !== undefined) data.bannerUrl = input.bannerUrl;

    return await prisma.$transaction(async (tx) => {
      const updatedShop = await tx.shop.update({
        where: { id: shopId },
        data,
      });

      await AuditService.record(
        {
          actorId: session.user.id,
          action: "SHOP_UPDATED",
          entity: "Shop",
          entityId: shopId,
          metadata: {
            shopId,
            changes: input,
          },
        },
        tx
      );

      return updatedShop;
    });
  }

  /**
   * Lists all members of a shop with profile details.
   * Strictly requires SUPER_ADMIN or CAMPUS_ADMIN.
   */
  static async listShopMembers(session: SessionContext, shopId: string) {
    assertAuthenticated(session);
    assertUserRole(session, ["CAMPUS_ADMIN", "SUPER_ADMIN"]);

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, campusId: true },
    });

    if (!shop) {
      throw new NotFoundError("Shop", shopId);
    }

    assertCampusAccess(session, shop.campusId);

    const members = await prisma.shopMember.findMany({
      where: { shopId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            campusId: true,
            isActive: true,
            profile: {
              select: {
                fullName: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return members;
  }

  /**
   * Assigns or updates a user's role on a shop (OWNER, MANAGER, STAFF).
   * Strictly requires SUPER_ADMIN or CAMPUS_ADMIN.
   * Locks the parent shop row to guarantee concurrency-safe last-owner protection.
   * Enforces same-campus membership eligibility.
   */
  static async assignShopMember(
    session: SessionContext,
    shopId: string,
    rawInput: AssignShopMemberInput
  ) {
    assertAuthenticated(session);
    assertUserRole(session, ["CAMPUS_ADMIN", "SUPER_ADMIN"]);
    const input = assignShopMemberInputSchema.parse(rawInput);

    return await prisma.$transaction(async (tx) => {
      // 1. Acquire exclusive pessimistic lock on the parent shop row
      const lockedShops = await tx.$queryRaw<Array<{ id: string; campusId: string }>>`
        SELECT id, "campusId" FROM "shops" WHERE id = ${shopId} FOR UPDATE
      `;
      const lockedShop = lockedShops[0];
      if (!lockedShop) {
        throw new NotFoundError("Shop", shopId);
      }

      // Enforce campus boundary
      assertCampusAccess(session, lockedShop.campusId);

      // 2. Validate target user existence and active status
      const targetUser = await tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true, campusId: true, isActive: true },
      });

      if (!targetUser) {
        throw new NotFoundError("User", input.userId);
      }

      if (!targetUser.isActive) {
        throw new ValidationError("Cannot assign membership to an inactive user account");
      }

      // 3. Enforce same-campus eligibility (prevent cross-campus assignment)
      if (targetUser.campusId !== lockedShop.campusId) {
        throw new ForbiddenError("Cannot assign membership: User belongs to a different campus");
      }

      // 4. Concurrency-safe demotion check:
      // If user is currently an active OWNER and being demoted to MANAGER or STAFF,
      // verify that at least one other active OWNER remains.
      const existingMembership = await tx.shopMember.findUnique({
        where: {
          shopId_userId: {
            shopId,
            userId: input.userId,
          },
        },
      });

      if (
        existingMembership &&
        existingMembership.role === "OWNER" &&
        existingMembership.isActive &&
        input.role !== "OWNER"
      ) {
        const otherActiveOwnersCount = await tx.shopMember.count({
          where: {
            shopId,
            role: "OWNER",
            isActive: true,
            userId: { not: input.userId },
          },
        });

        if (otherActiveOwnersCount === 0) {
          throw new ConflictError(
            "Cannot demote the last active Owner of this shop. Assign another Owner before demoting this member."
          );
        }
      }

      // 5. Upsert membership
      const member = await tx.shopMember.upsert({
        where: {
          shopId_userId: {
            shopId,
            userId: input.userId,
          },
        },
        create: {
          shopId,
          userId: input.userId,
          role: input.role,
          isActive: true,
        },
        update: {
          role: input.role,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              profile: { select: { fullName: true } },
            },
          },
        },
      });

      // 6. Write audit log atomically
      await AuditService.record(
        {
          actorId: session.user.id,
          action: "SHOP_MEMBER_ASSIGNED",
          entity: "ShopMember",
          entityId: member.id,
          metadata: {
            shopId,
            userId: input.userId,
            role: input.role,
            previousRole: existingMembership?.role ?? null,
          },
        },
        tx
      );

      return member;
    });
  }

  /**
   * Revokes a membership from a shop.
   * Strictly requires SUPER_ADMIN or CAMPUS_ADMIN.
   * Locks the parent shop row to guarantee concurrency-safe last-owner protection.
   */
  static async revokeShopMember(
    session: SessionContext,
    shopId: string,
    memberId: string
  ) {
    assertAuthenticated(session);
    assertUserRole(session, ["CAMPUS_ADMIN", "SUPER_ADMIN"]);

    return await prisma.$transaction(async (tx) => {
      // 1. Acquire exclusive pessimistic lock on the parent shop row
      const lockedShops = await tx.$queryRaw<Array<{ id: string; campusId: string }>>`
        SELECT id, "campusId" FROM "shops" WHERE id = ${shopId} FOR UPDATE
      `;
      const lockedShop = lockedShops[0];
      if (!lockedShop) {
        throw new NotFoundError("Shop", shopId);
      }

      assertCampusAccess(session, lockedShop.campusId);

      // 2. Fetch target member
      const targetMember = await tx.shopMember.findUnique({
        where: { id: memberId },
      });

      if (!targetMember || targetMember.shopId !== shopId) {
        throw new NotFoundError("Shop member", memberId);
      }

      // 3. Concurrency-safe last-owner check:
      // If revoking an active OWNER, verify at least one other active OWNER exists.
      if (targetMember.role === "OWNER" && targetMember.isActive) {
        const otherActiveOwnersCount = await tx.shopMember.count({
          where: {
            shopId,
            role: "OWNER",
            isActive: true,
            id: { not: memberId },
          },
        });

        if (otherActiveOwnersCount === 0) {
          throw new ConflictError(
            "Cannot revoke the last active Owner of this shop. Assign another Owner before removing this member."
          );
        }
      }

      // 4. Deactivate membership
      const updated = await tx.shopMember.update({
        where: { id: memberId },
        data: { isActive: false },
      });

      // 5. Write audit log atomically
      await AuditService.record(
        {
          actorId: session.user.id,
          action: "SHOP_MEMBER_REVOKED",
          entity: "ShopMember",
          entityId: memberId,
          metadata: {
            shopId,
            userId: targetMember.userId,
            role: targetMember.role,
          },
        },
        tx
      );

      return {
        success: true,
        memberId: updated.id,
        shopId: updated.shopId,
        isActive: updated.isActive,
      };
    });
  }
}
