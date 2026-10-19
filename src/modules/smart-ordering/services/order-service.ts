import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/core/db/prisma";
import {
  assertAuthenticated,
  assertCampusAccess,
  assertShopAccess,
} from "@/core/auth/rbac";
import type { SessionContext } from "@/core/types/auth";
import { isRecognizedDevId } from "@/core/auth/session";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/core/errors";
import type {
  CreateOrderInput,
  CancelOrderInput,
  RejectOrderInput,
  AdvanceOrderStatusInput,
  PriceMismatchDetail,
  OrderWithDetails,
} from "../types";
import {
  createOrderInputSchema,
  cancelOrderInputSchema,
  rejectOrderInputSchema,
  advanceOrderStatusInputSchema,
} from "../validation/order.schema";
import { assertValidOrderTransition } from "./order-state-machine";
import {
  PriceMismatchError,
  ShopClosedError,
  ProductUnavailableError,
} from "../errors";

/**
 * Generates a short, readable random alphanumeric order pickup code.
 * Format: 6 uppercase alphanumeric characters prefixed by '#' (e.g. #C7K9A2)
 */
function generateOrderNumberCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // excludes ambiguous 0, O, 1, I
  const bytes = randomBytes(5);
  let code = "#";
  for (let i = 0; i < 5; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export class OrderService {
  /**
   * Places a new Smart Order.
   * - Re-validates that the shop is open.
   * - Verifies that all products exist and are marked available.
   * - Validates that client expected prices match authoritative server prices.
   * - Computes totals server-side using exact Decimal arithmetic.
   * - Assigns a unique, readable pickup token.
   * - Evaluates shop auto-acceptance setting (defaults to PLACED; CONFIRMED if auto-accept enabled).
   * - Executes atomically within a Prisma transaction with idempotency protection.
   */
  static async createOrder(
    session: SessionContext,
    rawInput: CreateOrderInput
  ): Promise<OrderWithDetails> {
    assertAuthenticated(session);
    const input = createOrderInputSchema.parse(rawInput);

    // 1. Check idempotency if a key is provided
    if (input.idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
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
          statusHistory: true,
        },
      });

      if (existing) {
        // Enforce student tenancy on idempotency retrieval
        if (existing.userId !== session.user.id) {
          throw new ConflictError("Idempotency key collision across accounts");
        }
        return existing;
      }
    }

    // 2. Fetch Shop and verify status
    const shop = await prisma.shop.findUnique({
      where: { id: input.shopId },
    });

    if (!shop) {
      throw new NotFoundError("Shop", input.shopId);
    }

    assertCampusAccess(session, shop.campusId);

    if (!shop.isOpen) {
      throw new ShopClosedError(shop.name);
    }

    // 3. Fetch all requested products belonging to this shop
    const productIds = input.items.map((i) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        shopId: shop.id,
      },
      include: {
        category: true,
      },
    });

    if (dbProducts.length !== productIds.length) {
      const foundIds = new Set(dbProducts.map((p) => p.id));
      const missingId = productIds.find((id) => !foundIds.has(id));
      throw new NotFoundError("Product in this shop", missingId);
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // 4. Verify product availability and check for price mismatches
    const priceMismatches: PriceMismatchDetail[] = [];

    for (const item of input.items) {
      const product = productMap.get(item.productId)!;

      // Item or Category unavailable -> reject entire order
      if (!product.isAvailable || !product.category.isAvailable) {
        throw new ProductUnavailableError(product.name);
      }

      // Exact decimal price validation
      const actualPriceStr = product.price.toFixed(2);
      const expectedPriceStr = new Prisma.Decimal(item.expectedUnitPrice).toFixed(2);

      if (actualPriceStr !== expectedPriceStr) {
        priceMismatches.push({
          productId: product.id,
          productName: product.name,
          expectedPrice: expectedPriceStr,
          actualPrice: actualPriceStr,
        });
      }
    }

    // If any price changed, halt and require explicit student confirmation
    if (priceMismatches.length > 0) {
      throw new PriceMismatchError(priceMismatches);
    }

    // 5. Calculate authoritative line item amounts and order total
    let totalAmount = new Prisma.Decimal(0);
    const orderItemsData = input.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = product.price;
      const subtotal = unitPrice.mul(item.quantity);
      totalAmount = totalAmount.add(subtotal);

      return {
        productId: product.id,
        productNameSnapshot: product.name,
        unitPriceSnapshot: unitPrice,
        quantity: item.quantity,
        subtotal,
        specialInstructions: item.specialInstructions?.trim() || null,
      };
    });

    // 6. Execute atomic creation inside a Prisma transaction
    const initialStatus = shop.autoAcceptOrders ? "CONFIRMED" : "PLACED";
    const now = new Date();

    return await prisma.$transaction(async (tx) => {
      // Concurrency guard: verify shop is still open inside transaction
      const currentShop = await tx.shop.findUnique({
        where: { id: shop.id },
        select: { isOpen: true, name: true },
      });
      if (!currentShop || !currentShop.isOpen) {
        throw new ShopClosedError(currentShop?.name || shop.name);
      }

      // Non-production local dev support: ensure recognized dev identity record exists so orders_userId_fkey is satisfied
      if (
        process.env.NODE_ENV !== "production" &&
        isRecognizedDevId(session.user.id)
      ) {
        await tx.user.upsert({
          where: { id: session.user.id },
          create: {
            id: session.user.id,
            email: session.user.email,
            role: "STUDENT",
            campusId: session.user.campusId,
            isActive: true,
          },
          update: {},
        });
      }

      // Generate collision-resistant orderNumber
      let orderNumber = generateOrderNumberCode();
      let attempts = 0;
      while (attempts < 5) {
        const existingToken = await tx.order.findFirst({
          where: { orderNumber },
          select: { id: true },
        });
        if (!existingToken) break;
        orderNumber = generateOrderNumberCode();
        attempts++;
      }

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          shopId: shop.id,
          userId: session.user.id,
          status: initialStatus,
          totalAmount,
          currency: "INR",
          placedAt: now,
          confirmedAt: shop.autoAcceptOrders ? now : null,
          idempotencyKey: input.idempotencyKey || null,
          items: {
            create: orderItemsData,
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: initialStatus,
              changedById: session.user.id,
              reason: shop.autoAcceptOrders
                ? "Auto-accepted per shop configuration"
                : "Initial student order placement",
            },
          },
          payments: {
            create: {
              amount: totalAmount,
              currency: "INR",
              status: "PENDING",
              provider: "MOCK_TEST",
            },
          },
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
          statusHistory: true,
        },
      });

      return createdOrder;
    });
  }

  /**
   * Accepts a pending order (manual acceptance by kiosk staff).
   * Atomically transitions PLACED -> CONFIRMED.
   */
  static async acceptOrder(
    session: SessionContext,
    orderId: string
  ): Promise<OrderWithDetails> {
    assertAuthenticated(session);

    // Retrieve order to identify shop
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { shopId: true, status: true },
    });

    if (!order) {
      throw new NotFoundError("Order", orderId);
    }

    const membership = assertShopAccess(session, order.shopId, ["OWNER", "MANAGER", "STAFF"]);
    assertValidOrderTransition(order.status, "CONFIRMED");

    const now = new Date();

    return await prisma.$transaction(async (tx) => {
      const updateResult = await tx.order.updateMany({
        where: {
          id: orderId,
          shopId: membership.shopId,
          status: "PLACED", // Concurrency guard: must strictly still be PLACED
        },
        data: {
          status: "CONFIRMED",
          confirmedAt: now,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictError(
          "Order could not be accepted. It may have already been accepted, cancelled, or expired."
        );
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: "PLACED",
          toStatus: "CONFIRMED",
          changedById: session.user.id,
          reason: "Accepted by kiosk staff",
        },
      });

      return await tx.order.findUniqueOrThrow({
        where: { id: orderId },
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
          statusHistory: true,
        },
      });
    });
  }

  /**
   * Rejects an incoming order by kiosk staff.
   * Atomically transitions PLACED -> REJECTED with mandatory reason.
   */
  static async rejectOrder(
    session: SessionContext,
    orderId: string,
    rawInput: RejectOrderInput
  ): Promise<OrderWithDetails> {
    assertAuthenticated(session);
    const input = rejectOrderInputSchema.parse(rawInput);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { shopId: true, status: true },
    });

    if (!order) {
      throw new NotFoundError("Order", orderId);
    }

    const membership = assertShopAccess(session, order.shopId, ["OWNER", "MANAGER", "STAFF"]);
    assertValidOrderTransition(order.status, "REJECTED");

    return await prisma.$transaction(async (tx) => {
      const updateResult = await tx.order.updateMany({
        where: {
          id: orderId,
          shopId: membership.shopId,
          status: "PLACED", // Concurrency guard
        },
        data: {
          status: "REJECTED",
          rejectionReason: input.rejectionReason,
          rejectionNote: input.rejectionNote?.trim() || null,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictError(
          "Order could not be rejected. It may have already been accepted, cancelled, or expired."
        );
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: "PLACED",
          toStatus: "REJECTED",
          changedById: session.user.id,
          reason: input.rejectionNote
            ? `${input.rejectionReason}: ${input.rejectionNote}`
            : input.rejectionReason,
        },
      });

      return await tx.order.findUniqueOrThrow({
        where: { id: orderId },
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
          statusHistory: true,
        },
      });
    });
  }

  /**
   * Cancels an order by the student.
   * LOCKED RULE: Student may only cancel while status is strictly PLACED.
   * Once confirmed or in preparation, cancellation is forbidden.
   */
  static async cancelOrder(
    session: SessionContext,
    orderId: string,
    rawInput: CancelOrderInput
  ): Promise<OrderWithDetails> {
    assertAuthenticated(session);
    const input = cancelOrderInputSchema.parse(rawInput);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, status: true },
    });

    if (!order) {
      throw new NotFoundError("Order", orderId);
    }

    if (order.userId !== session.user.id) {
      throw new ForbiddenError("You cannot cancel another student's order");
    }

    if (order.status !== "PLACED") {
      throw new ConflictError(
        `Order cannot be cancelled in status '${order.status}'. Cancellation is only allowed before shop acceptance.`
      );
    }

    return await prisma.$transaction(async (tx) => {
      const updateResult = await tx.order.updateMany({
        where: {
          id: orderId,
          userId: session.user.id,
          status: "PLACED", // Concurrency guard: must still be PLACED
        },
        data: {
          status: "CANCELLED",
          cancellationReason: input.cancellationReason,
          cancellationNote: input.cancellationNote?.trim() || null,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictError(
          "Order could not be cancelled: It was already accepted by the kiosk or expired."
        );
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: "PLACED",
          toStatus: "CANCELLED",
          changedById: session.user.id,
          reason: input.cancellationNote
            ? `${input.cancellationReason}: ${input.cancellationNote}`
            : input.cancellationReason,
        },
      });

      return await tx.order.findUniqueOrThrow({
        where: { id: orderId },
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
          statusHistory: true,
        },
      });
    });
  }

  /**
   * Advances order through linear fulfillment:
   * CONFIRMED -> PREPARING -> READY -> PICKED_UP -> COMPLETED
   */
  static async advanceOrderStatus(
    session: SessionContext,
    orderId: string,
    rawInput: AdvanceOrderStatusInput
  ): Promise<OrderWithDetails> {
    assertAuthenticated(session);
    const input = advanceOrderStatusInputSchema.parse(rawInput);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { shopId: true, status: true, orderNumber: true },
    });

    if (!order) {
      throw new NotFoundError("Order", orderId);
    }

    const membership = assertShopAccess(session, order.shopId, ["OWNER", "MANAGER", "STAFF"]);
    assertValidOrderTransition(order.status, input.targetStatus);

    // Secure pickup verification: require matching order number code before transitioning to PICKED_UP
    if (input.targetStatus === "PICKED_UP") {
      const normalizedProvided = input.pickupCode?.replace(/^#/, "").trim().toUpperCase();
      const normalizedActual = order.orderNumber.replace(/^#/, "").trim().toUpperCase();
      if (normalizedProvided !== normalizedActual) {
        throw new ConflictError(
          "Pickup verification failed: Provided pickup code does not match the order number."
        );
      }
    }

    const now = new Date();
    const timestampUpdates: Prisma.OrderUpdateInput = {};
    if (input.targetStatus === "PREPARING") timestampUpdates.preparingAt = now;
    if (input.targetStatus === "READY") timestampUpdates.readyAt = now;
    if (input.targetStatus === "PICKED_UP") timestampUpdates.pickedUpAt = now;
    if (input.targetStatus === "COMPLETED") timestampUpdates.completedAt = now;

    return await prisma.$transaction(async (tx) => {
      const updateResult = await tx.order.updateMany({
        where: {
          id: orderId,
          shopId: membership.shopId,
          status: order.status, // Concurrency guard: must match expected current status
        },
        data: {
          status: input.targetStatus,
          ...timestampUpdates,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictError(
          `Failed to advance order: Order status has changed from '${order.status}'.`
        );
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: input.targetStatus,
          changedById: session.user.id,
          reason: input.note?.trim() || `Advanced to ${input.targetStatus}`,
        },
      });

      return await tx.order.findUniqueOrThrow({
        where: { id: orderId },
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
          statusHistory: true,
        },
      });
    });
  }

  /**
   * Retrieves order details with strict tenant isolation:
   * Accessible by the student owner, staff of the shop, or SUPER_ADMIN.
   */
  static async getOrderById(
    session: SessionContext,
    orderId: string
  ): Promise<OrderWithDetails> {
    assertAuthenticated(session);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
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
        statusHistory: true,
      },
    });

    if (!order) {
      throw new NotFoundError("Order", orderId);
    }

    // Permission check
    const isOwner = order.userId === session.user.id;
    const isShopStaff = session.shopMemberships.some(
      (m) => m.shopId === order.shopId && m.isActive
    );
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    if (!isOwner && !isShopStaff && !isSuperAdmin) {
      throw new ForbiddenError("You do not have permission to view this order");
    }

    return order;
  }
}
