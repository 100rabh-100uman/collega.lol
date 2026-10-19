import type { OrderStatus } from "@prisma/client";

export interface AuthorizedShop {
  id: string;
  campusId: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  isOpen: boolean;
  autoAcceptOrders: boolean;
  role: "OWNER" | "MANAGER" | "STAFF";
  isActive: boolean;
}

export interface QueueOrderItem {
  id: string;
  orderId?: string;
  productId?: string | null;
  productNameSnapshot?: string;
  productName?: string;
  unitPriceSnapshot?: string | number;
  unitPrice?: string | number;
  quantity: number;
  subtotal: string | number;
  specialInstructions: string | null;
}

export interface QueueOrderPayment {
  id: string;
  amount: string | number;
  currency: string;
  status: string;
  provider: string;
}

export interface QueueOrderStatusHistory {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedById: string;
  reason: string | null;
  createdAt: string;
}

export interface QueueOrder {
  id: string;
  orderNumber: string;
  shopId: string;
  userId: string;
  status: OrderStatus;
  totalAmount: string | number;
  currency: string;
  placedAt: string;
  confirmedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  pickedUpAt: string | null;
  completedAt: string | null;
  rejectionReason: string | null;
  rejectionNote: string | null;
  items: QueueOrderItem[];
  user: {
    id: string;
    email: string;
    profile?: {
      fullName: string | null;
      phone: string | null;
    } | null;
  };
  payments: QueueOrderPayment[];
  statusHistory: QueueOrderStatusHistory[];
}

export interface MenuProduct {
  id: string;
  shopId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string | number;
  imageUrl: string | null;
  isAvailable: boolean;
  preparationTimeMins: number | null;
  sortOrder: number;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface MenuCategory {
  id: string;
  shopId: string;
  name: string;
  slug: string;
  sortOrder: number;
  isAvailable: boolean;
  products: MenuProduct[];
}
