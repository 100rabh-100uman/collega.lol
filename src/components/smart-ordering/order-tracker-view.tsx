"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CancelOrderModal, type CancellationReasonType } from "./cancel-order-modal";
import { formatPriceINR } from "@/lib/currency";
import {
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Info,
  Check,
  ShoppingBag,
} from "lucide-react";

export interface TrackedOrder {
  id: string;
  orderNumber: string;
  status:
    | "PLACED"
    | "CONFIRMED"
    | "PREPARING"
    | "READY"
    | "PICKED_UP"
    | "COMPLETED"
    | "CANCELLED"
    | "REJECTED"
    | "EXPIRED"
    | "FAILED";
  totalAmount: string | number;
  placedAt: string;
  confirmedAt?: string | null;
  readyAt?: string | null;
  completedAt?: string | null;
  shop: {
    id: string;
    name: string;
    location: string | null;
  };
  items: Array<{
    id: string;
    productNameSnapshot?: string;
    unitPriceSnapshot?: string | number;
    subtotal?: string | number;
    productName?: string;
    quantity: number;
    unitPrice?: string | number;
    totalPrice?: string | number;
    specialInstructions?: string | null;
  }>;
  rejectionReason?: string | null;
  rejectionNote?: string | null;
  cancellationReason?: string | null;
  cancellationNote?: string | null;
  statusHistory?: Array<{
    status: string;
    createdAt: string;
    note?: string | null;
  }>;
  payments?: Array<{
    provider: string;
    status: string;
  }>;
}

function formatRejectionReason(reason?: string | null): string {
  if (!reason) return "Operational reason";
  switch (reason) {
    case "OUT_OF_STOCK":
      return "Item(s) out of stock";
    case "KITCHEN_OVERLOADED":
      return "Kitchen overloaded / high backlog";
    case "STORE_CLOSING_EARLY":
      return "Shop closing early / maintenance";
    case "ITEM_PRICE_MISMATCH":
      return "Item price or recipe mismatch";
    case "OTHER":
      return "Other operational reason";
    default:
      return reason.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }
}

function formatCancellationReason(reason?: string | null): string {
  if (!reason) return "Cancelled by student";
  switch (reason) {
    case "WAIT_TIME_TOO_LONG":
      return "Wait time is too long";
    case "ORDERED_BY_MISTAKE":
      return "Ordered by mistake";
    case "VENDOR_UNRESPONSIVE":
      return "Vendor is unresponsive";
    case "OTHER":
      return "Other reason";
    default:
      return reason.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }
}

const TIMELINE_STEPS = [
  { key: "PLACED", label: "Order Placed" },
  { key: "CONFIRMED", label: "Accepted by Shop" },
  { key: "PREPARING", label: "Preparing Meal" },
  { key: "READY", label: "Ready for Pickup" },
  { key: "PICKED_UP", label: "Picked Up" },
] as const;

const ACTIVE_STATUSES = new Set(["PLACED", "CONFIRMED", "PREPARING", "READY"]);

interface OrderTrackerViewProps {
  orderId: string;
}

export function OrderTrackerView({ orderId }: OrderTrackerViewProps) {
  const [order, setOrder] = React.useState<TrackedOrder | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Cancellation state
  const [isCancelModalOpen, setIsCancelModalOpen] = React.useState<boolean>(false);
  const [isCancelling, setIsCancelling] = React.useState<boolean>(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  // Initial fetch on mount
  React.useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          headers: { "Content-Type": "application/json" },
        });

        if (ignore) return;

        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error?.message || "Failed to load order tracking data");
        }

        const json = await res.json();
        if (ignore) return;

        if (json.success && json.data) {
          setOrder(json.data);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Error loading order");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadInitial();

    return () => {
      ignore = true;
    };
  }, [orderId]);

  const isOrderActive = order?.status ? ACTIVE_STATUSES.has(order.status) : false;

  // Active status polling (every 4 seconds, clean up on unmount or terminal state)
  React.useEffect(() => {
    if (!isOrderActive) {
      return;
    }

    let isPolling = false;
    const intervalId = setInterval(async () => {
      if (isPolling) return;
      isPolling = true;

      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.success && json.data) {
            setOrder(json.data);
          }
        }
      } catch {
        // Soft fail on background polling tick
      } finally {
        isPolling = false;
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [isOrderActive, orderId]);

  // Handle student order cancellation (PLACED only)
  const handleConfirmCancel = async (reason: CancellationReasonType, note?: string) => {
    setIsCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancellationReason: reason,
          cancellationNote: note,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || "Cancellation failed");
      }

      setOrder(json.data);
      setIsCancelModalOpen(false);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel order");
    } finally {
      setIsCancelling(false);
    }
  };

  // Status badge helper
  const getStatusBadge = (status: TrackedOrder["status"]) => {
    switch (status) {
      case "PLACED":
        return <Badge variant="warning">Awaiting Shop Acceptance</Badge>;
      case "CONFIRMED":
        return <Badge variant="default">Accepted &bull; In Queue</Badge>;
      case "PREPARING":
        return <Badge variant="default" className="bg-purple-600 dark:bg-purple-500">Preparing in Kitchen</Badge>;
      case "READY":
        return <Badge variant="success">Ready for Counter Pickup</Badge>;
      case "PICKED_UP":
        return <Badge variant="success">Picked Up</Badge>;
      case "COMPLETED":
        return <Badge variant="outline">Completed</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive">Cancelled by Student</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">Rejected by Shop</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto py-12">
        <div className="h-8 w-40 bg-muted animate-pulse rounded-md" />
        <div className="h-44 bg-muted/60 animate-pulse rounded-2xl" />
        <div className="h-64 bg-muted/40 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <Card className="max-w-xl mx-auto my-12 border-destructive/30">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
            <AlertCircle className="size-6" />
          </div>
          <CardTitle className="text-lg">Order Not Found</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {error || "Could not retrieve order details. You may not be authorized to view this order."}
          </p>
        </CardHeader>
        <CardContent className="text-center pt-4">
          <Link href="/order">
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-3.5 mr-1.5" />
              Return to Menu
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Current step index in linear fulfillment
  const stepIndexMap: Record<string, number> = {
    PLACED: 0,
    CONFIRMED: 1,
    PREPARING: 2,
    READY: 3,
    PICKED_UP: 4,
    COMPLETED: 4,
  };

  const currentStepIndex = stepIndexMap[order.status] ?? -1;
  const isTerminalTerminal = order.status === "CANCELLED" || order.status === "REJECTED" || order.status === "EXPIRED" || order.status === "FAILED";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/order"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Menu</span>
        </Link>

        <Link
          href="/order/history"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <span>View All Orders</span>
        </Link>
      </div>

      {/* Main Order Status Header Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Pickup Token
              </span>
              <span className="text-xs text-muted-foreground">&bull;</span>
              <span className="text-xs text-muted-foreground">
                {new Date(order.placedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="text-3xl font-extrabold tracking-widest font-mono text-primary">
              #{order.orderNumber}
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5">
            <div>{getStatusBadge(order.status)}</div>
            <span className="text-xs text-muted-foreground">{order.shop.name}</span>
          </div>
        </div>

        {/* Counter Pickup Alert Banner (when READY) */}
        {order.status === "READY" && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-3 animate-pulse">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="block font-bold text-sm text-foreground">
                Your order is ready for pickup!
              </strong>
              <p>
                Please proceed to the counter at <strong>{order.shop.location || order.shop.name}</strong> and show your token <strong className="font-mono">#{order.orderNumber}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Linear Fulfillment Timeline */}
        {!isTerminalTerminal ? (
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Live Fulfillment Progress
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {TIMELINE_STEPS.map((step, idx) => {
                const isPassed = currentStepIndex > idx;
                const isCurrent = currentStepIndex === idx;

                return (
                  <div
                    key={step.key}
                    className={`rounded-xl border p-3 flex flex-col justify-between text-xs transition-all ${
                      isCurrent
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                        : isPassed
                        ? "border-emerald-500/30 bg-emerald-500/5 text-muted-foreground"
                        : "border-border bg-muted/20 text-muted-foreground/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="size-5 rounded-full flex items-center justify-center text-[10px] font-bold border border-current">
                        {isPassed ? <Check className="size-3" /> : idx + 1}
                      </span>
                      {isCurrent && (
                        <span className="size-2 rounded-full bg-primary animate-ping" />
                      )}
                    </div>
                    <span className="text-[11px] leading-tight">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive space-y-2">
            {order.status === "REJECTED" ? (
              <>
                <div className="font-bold flex items-center gap-1.5 text-sm text-destructive">
                  <XCircle className="size-4 shrink-0" />
                  <span>Order Rejected by Shop</span>
                </div>
                <div className="space-y-1 pt-1">
                  <div className="text-foreground">
                    <span className="font-semibold text-muted-foreground">Reason: </span>
                    <span className="font-medium">{formatRejectionReason(order.rejectionReason)}</span>
                  </div>
                  {order.rejectionNote && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-foreground italic text-xs mt-1">
                      &ldquo;{order.rejectionNote}&rdquo;
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground text-[11px] pt-1">
                  This order was declined by the shop. You can place a new order from the catalog.
                </p>
              </>
            ) : order.status === "CANCELLED" ? (
              <>
                <div className="font-bold flex items-center gap-1.5 text-sm text-destructive">
                  <XCircle className="size-4 shrink-0" />
                  <span>Order Cancelled</span>
                </div>
                <div className="space-y-1 pt-1">
                  <div className="text-foreground">
                    <span className="font-semibold text-muted-foreground">Reason: </span>
                    <span className="font-medium">{formatCancellationReason(order.cancellationReason)}</span>
                  </div>
                  {order.cancellationNote && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-foreground italic text-xs mt-1">
                      &ldquo;{order.cancellationNote}&rdquo;
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground text-[11px] pt-1">
                  You cancelled this order. You can place a new order from the catalog.
                </p>
              </>
            ) : (
              <>
                <div className="font-bold flex items-center gap-1.5">
                  <XCircle className="size-4" />
                  Order Terminal State: {order.status}
                </div>
                <p className="text-muted-foreground">
                  This order has been closed. You can place a new order from the catalog.
                </p>
              </>
            )}
          </div>
        )}

        {/* Cancellation Section (strictly PLACED only) */}
        {order.status === "PLACED" && (
          <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4">
            <div className="text-xs text-muted-foreground space-y-0.5">
              <span className="font-semibold text-foreground block">Need to cancel?</span>
              <span>You may cancel your order while it is awaiting shop acceptance.</span>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsCancelModalOpen(true)}
              className="shrink-0"
            >
              Cancel Order
            </Button>
          </div>
        )}

        {order.status !== "PLACED" && !isTerminalTerminal && (
          <div className="text-[11px] text-muted-foreground italic border-t border-border/50 pt-3">
            Note: Order has been accepted by the kitchen and can no longer be cancelled.
          </div>
        )}
      </div>

      {/* Simulated Payment Notice */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
        <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <strong className="block text-foreground font-semibold">
            Test Order &bull; Simulated Payment Notice
          </strong>
          <span>
            Payment is simulated (<code className="font-mono text-[11px]">MOCK_TEST</code>). No real funds were charged or processed. Counter pickup verification only.
          </span>
        </div>
      </div>

      {/* Items Summary & Shop Location */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <ShoppingBag className="size-4 text-primary" />
            Ordered Items
          </h3>
          <span className="text-xs text-muted-foreground font-mono">
            {order.items.length} item{order.items.length === 1 ? "" : "s"}
          </span>
        </div>

        {order.shop.location && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pb-2">
            <MapPin className="size-3.5 text-primary shrink-0" />
            <span>Pickup at: {order.shop.location}</span>
          </div>
        )}

        <div className="space-y-3">
          {order.items.map((item) => {
            const productName = item.productNameSnapshot || item.productName || "Item";
            const linePrice = item.subtotal ?? item.totalPrice ?? item.unitPriceSnapshot ?? item.unitPrice;
            return (
              <div key={item.id} className="flex items-start justify-between gap-4 text-xs py-1 border-b border-border/40 last:border-b-0">
                <div className="space-y-0.5">
                  <span className="font-semibold text-foreground">
                    {item.quantity}x {productName}
                  </span>
                  {item.specialInstructions && (
                    <p className="text-[11px] text-muted-foreground italic">
                      Note: &ldquo;{item.specialInstructions}&rdquo;
                    </p>
                  )}
                </div>
                <span className="font-mono text-foreground font-semibold">
                  {formatPriceINR(linePrice!)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between border-t border-border/80 pt-3 text-sm font-bold text-foreground">
          <span>Total (Authoritative)</span>
          <span className="font-mono text-base">{formatPriceINR(order.totalAmount)}</span>
        </div>
      </div>

      {/* Cancellation Modal */}
      <CancelOrderModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        orderNumber={order.orderNumber}
        onConfirmCancel={handleConfirmCancel}
        isCancelling={isCancelling}
        errorMessage={cancelError}
      />
    </div>
  );
}
