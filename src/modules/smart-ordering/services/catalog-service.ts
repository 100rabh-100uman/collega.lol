import { Prisma, type OrderStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "@/core/db/prisma";
import { assertAuthenticated, assertCampusAccess, assertShopAccess } from "@/core/auth/rbac";
import type { SessionContext } from "@/core/types/auth";
import { NotFoundError, ConflictError, ValidationError } from "@/core/errors";
import { createAdminSupabaseClient } from "@/core/supabase/admin";
import {
  createCategoryInputSchema,
  updateCategoryInputSchema,
  createProductInputSchema,
  updateProductInputSchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type CreateProductInput,
  type UpdateProductInput,
} from "../validation/menu.schema";

export class CatalogService {
  /**
   * Lists all active shops in the student's campus.
   * Enforces campus isolation based on the session's campusId.
   */
  static async listShops(session: SessionContext) {
    assertAuthenticated(session);

    // If user has no campus assigned and is not a cross-campus super admin, return empty list
    if (!session.user.campusId && session.user.role !== "SUPER_ADMIN") {
      return [];
    }

    const shops = await prisma.shop.findMany({
      where: {
        ...(session.user.role === "SUPER_ADMIN" && !session.user.campusId
          ? {}
          : { campusId: session.user.campusId! }),
      },
      select: {
        id: true,
        campusId: true,
        name: true,
        slug: true,
        description: true,
        location: true,
        isOpen: true,
        autoAcceptOrders: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    return shops;
  }

  /**
   * Lists all public shops in a campus for the public shop directory.
   * Does not require authentication; returns only public shop metadata.
   */
  static async listPublicShops(campusId?: string) {
    const targetCampusId = campusId || "00000001-0000-4000-8000-000000000001";
    return prisma.shop.findMany({
      where: { campusId: targetCampusId },
      select: {
        id: true,
        campusId: true,
        name: true,
        slug: true,
        description: true,
        location: true,
        isOpen: true,
        autoAcceptOrders: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Finds a public shop by slug or ID for public shop details.
   */
  static async getPublicShopBySlug(slugOrId: string) {
    const shop = await prisma.shop.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
      },
      select: {
        id: true,
        campusId: true,
        name: true,
        slug: true,
        description: true,
        location: true,
        isOpen: true,
        autoAcceptOrders: true,
        createdAt: true,
      },
    });

    if (!shop) {
      throw new NotFoundError("Shop", slugOrId);
    }

    return shop;
  }

  /**
   * Retrieves a shop's active menu catalog.
   * Only returns categories and products marked as available.
   * Enforces that the student belongs to the same campus as the shop.
   */
  static async getShopMenu(session: SessionContext, shopId: string) {
    assertAuthenticated(session);

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        campusId: true,
        name: true,
        slug: true,
        description: true,
        location: true,
        isOpen: true,
        autoAcceptOrders: true,
      },
    });

    if (!shop) {
      throw new NotFoundError("Shop", shopId);
    }

    assertCampusAccess(session, shop.campusId);

    const categories = await prisma.category.findMany({
      where: {
        shopId: shop.id,
        isAvailable: true,
      },
      orderBy: { sortOrder: "asc" },
      include: {
        products: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            preparationTimeMins: true,
            imageUrl: true,
            isAvailable: true,
            sortOrder: true,
          },
        },
      },
    });

    return {
      shop,
      categories,
    };
  }

  /**
   * Lists the student's order history or active orders.
   */
  static async listStudentOrders(session: SessionContext, activeOnly = false) {
    assertAuthenticated(session);

    const activeStatuses: OrderStatus[] = [
      "PLACED",
      "CONFIRMED",
      "PREPARING",
      "READY",
    ];

    const orders = await prisma.order.findMany({
      where: {
        userId: session.user.id,
        ...(activeOnly ? { status: { in: activeStatuses } } : {}),
      },
      include: {
        items: true,
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            location: true,
            isOpen: true,
          },
        },
        payments: true,
        statusHistory: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { placedAt: "desc" },
    });

    return orders;
  }

  /**
   * Lists active queue orders for a shop (FIFO order for kiosk/kitchen displays).
   * Enforces shop membership permissions.
   */
  static async listShopOrderQueue(
    session: SessionContext,
    shopId: string,
    statusFilter?: OrderStatus[]
  ) {
    assertAuthenticated(session);
    assertShopAccess(session, shopId, ["OWNER", "MANAGER", "STAFF"]);

    const defaultActiveStatuses: OrderStatus[] = [
      "PLACED",
      "CONFIRMED",
      "PREPARING",
      "READY",
    ];

    const targetStatuses =
      statusFilter && statusFilter.length > 0
        ? statusFilter
        : defaultActiveStatuses;

    const orders = await prisma.order.findMany({
      where: {
        shopId,
        status: { in: targetStatuses },
      },
      include: {
        items: true,
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                fullName: true,
                phone: true,
              },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
        },
        payments: true,
      },
      orderBy: { placedAt: "asc" }, // FIFO for kitchen processing
    });

    return orders;
  }

  /**
   * Toggles shop open/closed status (pause/resume ordering).
   * Enforces OWNER or MANAGER shop role.
   */
  static async toggleShopOpen(
    session: SessionContext,
    shopId: string,
    isOpen: boolean
  ) {
    assertAuthenticated(session);
    assertShopAccess(session, shopId, ["OWNER", "MANAGER"]);

    const updatedShop = await prisma.shop.update({
      where: { id: shopId },
      data: { isOpen },
      select: {
        id: true,
        name: true,
        slug: true,
        isOpen: true,
        updatedAt: true,
      },
    });

    return updatedShop;
  }

  // --------------------------------------------------------------------------
  // Phase 6E: Manager Menu Management (Categories & Products)
  // --------------------------------------------------------------------------

  /**
   * Retrieves all categories and products for a shop (both available and unavailable).
   * Strictly requires OWNER or MANAGER shop role.
   */
  static async listManagerCategories(session: SessionContext, shopId: string) {
    assertAuthenticated(session);
    assertShopAccess(session, shopId, ["OWNER", "MANAGER"]);

    const categories = await prisma.category.findMany({
      where: { shopId },
      include: {
        products: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return categories;
  }

  /**
   * Creates a new category under a shop.
   * Strictly requires OWNER or MANAGER shop role. Enforces unique slug within the shop.
   */
  static async createCategory(
    session: SessionContext,
    shopId: string,
    rawInput: CreateCategoryInput
  ) {
    assertAuthenticated(session);
    assertShopAccess(session, shopId, ["OWNER", "MANAGER"]);
    const input = createCategoryInputSchema.parse(rawInput);

    const existingSlug = await prisma.category.findUnique({
      where: {
        shopId_slug: {
          shopId,
          slug: input.slug,
        },
      },
    });

    if (existingSlug) {
      throw new ConflictError(
        `A category with slug '${input.slug}' already exists in this shop`
      );
    }

    const category = await prisma.category.create({
      data: {
        shopId,
        name: input.name,
        slug: input.slug,
        sortOrder: input.sortOrder,
        isAvailable: input.isAvailable,
      },
      include: {
        products: true,
      },
    });

    return category;
  }

  /**
   * Updates an existing category.
   * Strictly requires OWNER or MANAGER shop role and enforces shop isolation.
   */
  static async updateCategory(
    session: SessionContext,
    shopId: string,
    categoryId: string,
    rawInput: UpdateCategoryInput
  ) {
    assertAuthenticated(session);
    assertShopAccess(session, shopId, ["OWNER", "MANAGER"]);
    const input = updateCategoryInputSchema.parse(rawInput);

    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory || existingCategory.shopId !== shopId) {
      throw new NotFoundError("Category", categoryId);
    }

    if (input.slug && input.slug !== existingCategory.slug) {
      const duplicateSlug = await prisma.category.findUnique({
        where: {
          shopId_slug: {
            shopId,
            slug: input.slug,
          },
        },
      });

      if (duplicateSlug) {
        throw new ConflictError(
          `A category with slug '${input.slug}' already exists in this shop`
        );
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isAvailable !== undefined ? { isAvailable: input.isAvailable } : {}),
      },
      include: {
        products: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
    });

    return updatedCategory;
  }

  /**
   * Creates a new product in the shop's catalog.
   * Strictly requires OWNER or MANAGER shop role.
   * Enforces that the assigned category belongs to the same shop.
   */
  static async createProduct(
    session: SessionContext,
    shopId: string,
    rawInput: CreateProductInput
  ) {
    assertAuthenticated(session);
    assertShopAccess(session, shopId, ["OWNER", "MANAGER"]);
    const input = createProductInputSchema.parse(rawInput);

    // Verify category belongs to this shop (prevents cross-shop category assignment)
    const category = await prisma.category.findUnique({
      where: { id: input.categoryId },
    });

    if (!category || category.shopId !== shopId) {
      throw new NotFoundError("Category in this shop", input.categoryId);
    }

    const product = await prisma.product.create({
      data: {
        shopId,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        price: new Prisma.Decimal(input.price),
        imageUrl: input.imageUrl,
        isAvailable: input.isAvailable,
        preparationTimeMins: input.preparationTimeMins,
        sortOrder: input.sortOrder,
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return product;
  }

  /**
   * Updates an existing product in the shop's catalog.
   * Strictly requires OWNER or MANAGER shop role.
   * Enforces that the product belongs to the shop and any new category belongs to the shop.
   */
  static async updateProduct(
    session: SessionContext,
    shopId: string,
    productId: string,
    rawInput: UpdateProductInput
  ) {
    assertAuthenticated(session);
    assertShopAccess(session, shopId, ["OWNER", "MANAGER"]);
    const input = updateProductInputSchema.parse(rawInput);

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existingProduct || existingProduct.shopId !== shopId) {
      throw new NotFoundError("Product", productId);
    }

    if (input.categoryId && input.categoryId !== existingProduct.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: input.categoryId },
      });

      if (!category || category.shopId !== shopId) {
        throw new NotFoundError("Category in this shop", input.categoryId);
      }
    }

    const data: Prisma.ProductUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.price !== undefined) data.price = new Prisma.Decimal(input.price);
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.isAvailable !== undefined) data.isAvailable = input.isAvailable;
    if (input.preparationTimeMins !== undefined) data.preparationTimeMins = input.preparationTimeMins;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.categoryId !== undefined) {
      data.category = { connect: { id: input.categoryId } };
    }

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return updatedProduct;
  }

  /**
   * Uploads a product photo to Supabase Storage.
   * Strictly server-side validated: enforces OWNER or MANAGER role, allowed MIME types, and 5MB size limit.
   */
  static async uploadProductImage(
    session: SessionContext,
    shopId: string,
    fileBuffer: Buffer,
    mimeType: string
  ) {
    assertAuthenticated(session);
    assertShopAccess(session, shopId, ["OWNER", "MANAGER"]);

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedMimeTypes.includes(mimeType)) {
      throw new ValidationError(
        "Invalid file format: Only JPEG, PNG, WebP, and GIF images are permitted"
      );
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5MB
    if (fileBuffer.byteLength > maxSizeBytes) {
      throw new ValidationError("File size exceeds the 5MB maximum limit");
    }

    const ext =
      mimeType === "image/png"
        ? "png"
        : mimeType === "image/webp"
        ? "webp"
        : mimeType === "image/gif"
        ? "gif"
        : "jpg";

    const storagePath = `${shopId}/${Date.now()}_${randomBytes(4).toString("hex")}.${ext}`;

    const admin = createAdminSupabaseClient();
    const { error: uploadError } = await admin.storage
      .from("product-images")
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload image to storage: ${uploadError.message}`);
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("product-images").getPublicUrl(storagePath);

    return { url: publicUrl };
  }
}
