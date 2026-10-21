"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { CheckCircle2, Clock, XCircle, AlertCircle, X, ArrowRight } from "lucide-react";

export interface TrackedActiveOrder {
  id: string;
  orderNumber: string;
  status: string;
  placedAt: string;
  shop: {
    id: string;
    name: string;
    location: string | null;
  };
}

export interface OrderStatusToast {
  id: string;
  orderId: string;
  orderNumber: string;
  oldStatus: string;
  newStatus: string;
  title: string;
  message: string;
  shopName?: string;
  type: "info" | "success" | "warning" | "destructive";
  timestamp: number;
}

interface ActiveOrdersContextValue {
  activeOrders: TrackedActiveOrder[];
  hasActiveOrders: boolean;
  activeCount: number;
  refreshActiveOrders: () => Promise<void>;
  toasts: OrderStatusToast[];
  dismissToast: (id: string) => void;
}

const ActiveOrdersContext = React.createContext<ActiveOrdersContextValue | null>(null);

function getToastContent(
  status: string,
  orderNumber: string,
  shopName?: string
): { title: string; message: string; type: "info" | "success" | "warning" | "destructive" } | null {
  switch (status) {
    case "CONFIRMED":
      return {
        title: "Order accepted",
        message: `Order #${orderNumber} has been accepted by ${shopName || "the shop"}.`,
        type: "success",
      };
    case "PREPARING":
      return {
        title: "Your order is being prepared",
        message: `Kitchen has started preparing order #${orderNumber}.`,
        type: "info",
      };
    case "READY":
      return {
        title: "Your order is ready for pickup",
        message: `Order #${orderNumber} is ready for pickup at ${shopName || "the counter"}!`,
        type: "success",
      };
    case "COMPLETED":
      return {
        title: "Order completed",
        message: `Order #${orderNumber} has been collected. Enjoy your meal!`,
        type: "info",
      };
    case "CANCELLED":
      return {
        title: "Order cancelled",
        message: `Order #${orderNumber} was cancelled.`,
        type: "warning",
      };
    case "REJECTED":
      return {
        title: "Order could not be accepted",
        message: `Order #${orderNumber} was declined by ${shopName || "the shop"}.`,
        type: "destructive",
      };
    default:
      return {
        title: `Order #${orderNumber}`,
        message: `Status updated to ${status.toLowerCase().replace(/_/g, " ")}.`,
        type: "info",
      };
  }
}

export function ActiveOrdersProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [activeOrders, setActiveOrders] = React.useState<TrackedActiveOrder[]>([]);
  const [toasts, setToasts] = React.useState<OrderStatusToast[]>([]);

  // Ref tracking orderId -> last known status
  const knownStatuses = React.useRef<Map<string, string>>(new Map());
  // Ref tracking orderId -> shopName
  const knownShopNames = React.useRef<Map<string, string>>(new Map());
  // Ref tracking orderId -> orderNumber
  const knownOrderNumbers = React.useRef<Map<string, string>>(new Map());

  const isInitialPoll = React.useRef(true);
  const isPollingRef = React.useRef(false);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = React.useCallback(
    (orderId: string, orderNumber: string, oldStatus: string, newStatus: string, shopName?: string) => {
      const content = getToastContent(newStatus, orderNumber, shopName);
      if (!content) return;

      const toastId = `${orderId}-${newStatus}-${Date.now()}`;
      const newToast: OrderStatusToast = {
        id: toastId,
        orderId,
        orderNumber,
        oldStatus,
        newStatus,
        title: content.title,
        message: content.message,
        shopName,
        type: content.type,
        timestamp: Date.now(),
      };

      setToasts((prev) => {
        // Prevent duplicate toasts for same order and status
        const exists = prev.some((t) => t.orderId === orderId && t.newStatus === newStatus);
        if (exists) return prev;
        return [...prev, newToast];
      });

      // Auto dismiss after 6 seconds
      setTimeout(() => {
        dismissToast(toastId);
      }, 6000);
    },
    [dismissToast]
  );

  const pollActiveOrders = React.useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const res = await fetch("/api/orders?active=true", { cache: "no-store" });
      if (!res.ok) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[ActiveOrders] Failed to fetch active orders: HTTP ${res.status}`);
        }
        return;
      }

      const json = await res.json().catch(() => null);
      if (!json || typeof json !== "object") {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[ActiveOrders] Invalid JSON received from /api/orders");
        }
        return;
      }

      if (!json.success) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[ActiveOrders] API returned unsuccessful response:", json.error?.code);
        }
        return;
      }

      // Canonical shape: json.data is Order[] directly. Compatibility shape: json.data.orders
      const orderList: unknown = Array.isArray(json.data)
        ? json.data
        : json.data && typeof json.data === "object" && Array.isArray((json.data as { orders?: unknown }).orders)
        ? (json.data as { orders: unknown[] }).orders
        : null;

      if (!orderList || !Array.isArray(orderList)) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[ActiveOrders] Malformed active orders payload shape; expected Array or { orders: Array }");
        }
        return;
      }

      const fetchedOrders: TrackedActiveOrder[] = orderList as TrackedActiveOrder[];
      setActiveOrders(fetchedOrders);

      // On initial poll, seed known statuses without firing notifications
      if (isInitialPoll.current) {
        isInitialPoll.current = false;
        fetchedOrders.forEach((o) => {
          knownStatuses.current.set(o.id, o.status);
          knownShopNames.current.set(o.id, o.shop?.name || "");
          knownOrderNumbers.current.set(o.id, o.orderNumber);
        });
        return;
      }

      // Check for status transitions in active orders
      const currentActiveIds = new Set<string>();

      fetchedOrders.forEach((o) => {
        currentActiveIds.add(o.id);
        const prevStatus = knownStatuses.current.get(o.id);
        const shopName = o.shop?.name || knownShopNames.current.get(o.id);

        if (prevStatus && prevStatus !== o.status) {
          addToast(o.id, o.orderNumber, prevStatus, o.status, shopName);
        }

        knownStatuses.current.set(o.id, o.status);
        if (o.shop?.name) knownShopNames.current.set(o.id, o.shop.name);
        knownOrderNumbers.current.set(o.id, o.orderNumber);
      });

      // Check for orders that left the active list (became terminal: COMPLETED, CANCELLED, REJECTED, etc.)
      const departedOrderIds: string[] = [];
      knownStatuses.current.forEach((_, orderId) => {
        if (!currentActiveIds.has(orderId)) {
          departedOrderIds.push(orderId);
        }
      });

      if (departedOrderIds.length > 0) {
        await Promise.all(
          departedOrderIds.map(async (orderId) => {
            const prevStatus = knownStatuses.current.get(orderId) || "ACTIVE";
            const orderNumber = knownOrderNumbers.current.get(orderId) || orderId.slice(0, 8);
            const shopName = knownShopNames.current.get(orderId);

            try {
              const detailRes = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
              if (detailRes.ok) {
                const detailJson = await detailRes.json().catch(() => null);
                if (detailJson && detailJson.success && detailJson.data) {
                  // Canonical shape: detailJson.data is Order. Compatibility: detailJson.data.order
                  const orderData =
                    (detailJson.data as { order?: { status?: string } }).order ||
                    (detailJson.data as { status?: string });
                  const terminalStatus = orderData?.status;
                  if (terminalStatus) {
                    addToast(orderId, orderNumber, prevStatus, terminalStatus, shopName);
                  }
                }
              }
            } catch (err) {
              if (process.env.NODE_ENV !== "production") {
                console.warn(`[ActiveOrders] Could not fetch terminal details for order ${orderId}:`, err);
              }
            } finally {
              // Permanently stop tracking this terminal order
              knownStatuses.current.delete(orderId);
              knownShopNames.current.delete(orderId);
              knownOrderNumbers.current.delete(orderId);
            }
          })
        );
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[ActiveOrders] Network or runtime error during polling:", err);
      }
    } finally {
      isPollingRef.current = false;
    }
  }, [addToast]);

  React.useEffect(() => {
    // Initial poll scheduled asynchronously
    const timeoutId = setTimeout(() => {
      void pollActiveOrders();
    }, 0);

    // 5-second interval polling
    const intervalId = setInterval(() => {
      void pollActiveOrders();
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [pollActiveOrders]);

  const value = React.useMemo<ActiveOrdersContextValue>(
    () => ({
      activeOrders,
      hasActiveOrders: activeOrders.length > 0,
      activeCount: activeOrders.length,
      refreshActiveOrders: pollActiveOrders,
      toasts,
      dismissToast,
    }),
    [activeOrders, pollActiveOrders, toasts, dismissToast]
  );

  return (
    <ActiveOrdersContext.Provider value={value}>
      {children}
      <OrderStatusToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ActiveOrdersContext.Provider>
  );
}

export function useActiveOrders(): ActiveOrdersContextValue {
  const context = React.useContext(ActiveOrdersContext);
  if (!context) {
    return {
      activeOrders: [],
      hasActiveOrders: false,
      activeCount: 0,
      refreshActiveOrders: async () => {},
      toasts: [],
      dismissToast: () => {},
    };
  }
  return context;
}

const emptySubscribe = () => () => {};

/**
 * Small subtle green pulsing indicator shown beside "My Orders"
 * whenever the student has at least one active order.
 */
export function ActiveOrderIndicator({ className }: Readonly<{ className?: string }>) {
  const { hasActiveOrders, activeCount } = useActiveOrders();
  const mounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted || !hasActiveOrders) return null;

  return (
    <span
      className={cn("relative flex size-2 shrink-0 items-center justify-center", className)}
      title={`${activeCount} active order${activeCount > 1 ? "s" : ""} in progress`}
      aria-label={`${activeCount} active order${activeCount > 1 ? "s" : ""} in progress`}
    >
      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping motion-reduce:hidden" />
      <span className="relative inline-flex size-2 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
      <span className="sr-only">Active order in progress</span>
    </span>
  );
}

/**
 * Accessible toast container for live order status transition notifications.
 */
function OrderStatusToastContainer({
  toasts,
  onDismiss,
}: Readonly<{
  toasts: OrderStatusToast[];
  onDismiss: (id: string) => void;
}>) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isDestructive = toast.type === "destructive";
        const isWarning = toast.type === "warning";

        let Icon = Clock;
        if (isSuccess) Icon = CheckCircle2;
        else if (isDestructive) Icon = XCircle;
        else if (isWarning) Icon = AlertCircle;

        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto rounded-xl border bg-card/95 backdrop-blur-md p-4 shadow-xl transition-all duration-200 animate-in slide-in-from-bottom-3 fade-in flex items-start gap-3",
              isSuccess && "border-emerald-500/30",
              isDestructive && "border-destructive/30",
              isWarning && "border-amber-500/30",
              !isSuccess && !isDestructive && !isWarning && "border-border"
            )}
          >
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg mt-0.5",
                isSuccess && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                isDestructive && "bg-destructive/10 text-destructive",
                isWarning && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                !isSuccess && !isDestructive && !isWarning && "bg-primary/10 text-primary"
              )}
            >
              <Icon className="size-4" />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-xs text-foreground tracking-tight">
                  {toast.title}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  #{toast.orderNumber}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {toast.message}
              </p>
              <div className="pt-1">
                <Link
                  href={`/order/${toast.orderId}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline transition-colors"
                >
                  <span>Track Order</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
