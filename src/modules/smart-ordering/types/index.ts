import type {
  OrderStatus,
  CancellationReason,
  RejectionReason,
  Prisma,
} from "@prisma/client";

export interface OrderItemInput {
  productId: string;
  quantity: number;
  expectedUnitPrice: string; // String representation of decimal to avoid float rounding
  specialInstructions?: string;
}

export interface CreateOrderInput {
  shopId: string;
  items: OrderItemInput[];
  idempotencyKey?: string;
}

export interface PriceMismatchDetail {
  productId: string;
  productName: string;
  expectedPrice: string;
  actualPrice: string;
}

export interface CancelOrderInput {
  cancellationReason: CancellationReason;
  cancellationNote?: string;
}

export interface RejectOrderInput {
  rejectionReason: RejectionReason;
  rejectionNote?: string;
}

export interface AdvanceOrderStatusInput {
  targetStatus: OrderStatus;
  pickupCode?: string;
  note?: string;
}

export type OrderWithDetails = Prisma.OrderGetPayload<{
  include: {
    items: true;
    shop: {
      select: {
        id: true;
        name: true;
        slug: true;
        location: true;
        isOpen: true;
      };
    };
    payments: true;
    statusHistory: true;
  };
}>;
