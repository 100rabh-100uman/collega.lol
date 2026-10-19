import { z } from "zod";

export const orderItemInputSchema = z.object({
  productId: z.string().uuid("Invalid product ID format"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than zero")
    .max(50, "Quantity exceeds maximum allowable per item (50)"),
  expectedUnitPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid expected price format; must be decimal with up to 2 decimal places"),
  specialInstructions: z
    .string()
    .max(250, "Special instructions must be under 250 characters")
    .optional(),
});

export const createOrderInputSchema = z
  .object({
    shopId: z.string().uuid("Invalid shop ID format"),
    items: z
      .array(orderItemInputSchema)
      .min(1, "Order must contain at least one item")
      .max(30, "Order cannot exceed 30 unique items"),
    idempotencyKey: z
      .string()
      .min(8, "Idempotency key must be at least 8 characters")
      .max(128, "Idempotency key cannot exceed 128 characters")
      .optional(),
  })
  .refine(
    (data) => {
      const productIds = new Set(data.items.map((item) => item.productId));
      return productIds.size === data.items.length;
    },
    {
      message: "Order cannot contain duplicate items; please consolidate quantities for each product",
      path: ["items"],
    }
  );

export const cancelOrderInputSchema = z.object({
  cancellationReason: z.enum(
    [
      "WAIT_TIME_TOO_LONG",
      "ORDERED_BY_MISTAKE",
      "VENDOR_UNRESPONSIVE",
      "OTHER",
    ],
    {
      message: "A valid cancellation reason is required",
    }
  ),
  cancellationNote: z
    .string()
    .max(500, "Cancellation note cannot exceed 500 characters")
    .optional(),
});

export const rejectOrderInputSchema = z.object({
  rejectionReason: z.enum(
    [
      "OUT_OF_STOCK",
      "KITCHEN_OVERLOADED",
      "STORE_CLOSING_EARLY",
      "ITEM_PRICE_MISMATCH",
      "OTHER",
    ],
    {
      message: "A valid rejection reason is required",
    }
  ),
  rejectionNote: z
    .string()
    .max(500, "Rejection note cannot exceed 500 characters")
    .optional(),
});

export const advanceOrderStatusInputSchema = z
  .object({
    targetStatus: z.enum([
      "CONFIRMED",
      "PREPARING",
      "READY",
      "PICKED_UP",
      "COMPLETED",
      "FAILED",
    ]),
    pickupCode: z.string().max(20, "Pickup code cannot exceed 20 characters").optional(),
    note: z.string().max(500, "Note cannot exceed 500 characters").optional(),
  })
  .refine(
    (data) => {
      if (data.targetStatus === "PICKED_UP") {
        return Boolean(data.pickupCode && data.pickupCode.trim().length > 0);
      }
      return true;
    },
    {
      message: "Pickup verification code is required when transitioning order to PICKED_UP",
      path: ["pickupCode"],
    }
  );
