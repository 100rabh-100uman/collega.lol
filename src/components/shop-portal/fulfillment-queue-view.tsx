"use client";

import * as React from "react";
import { formatPriceINR } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { RejectOrderModal, type ShopRejectionReasonType } from "./reject-order-modal";
import { PickupVerificationModal } from "./pickup-verification-modal";
import type { AuthorizedShop, QueueOrder } from "./types";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChefHat,
  PackageCheck,
  XCircle,
  Sparkles,
  ShieldAlert,
  Inbox,
  Filter,
} from "lucide-react";

interface FulfillmentQueueViewProps {
  shop: AuthorizedShop;
  initialOrders?: QueueOrder[];
}

type QueueTab = "all_active" | "placed" | "kitchen" | "ready" | "history";

export function FulfillmentQueueView({ shop }: FulfillmentQueueViewProps) {
  const [orders, setOrders] = React.useState<QueueOrder[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionInProgressOrderId, setActionInProgressOrderId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<QueueTab>("all_active");
  const [currentTimestamp, setCurrentTimestamp] = React.useState<number>(0);

  // Modals state
  const [rejectingOrder, setRejectingOrder] = React.useState<QueueOrder | null>(null);
  const [isRejecting, setIsRejecting] = React.useState<boolean>(false);
  const [rejectError, setRejectError] = React.useState<string | null>(null);

  const [verifyingOrder, setVerifyingOrder] = React.useState<QueueOrder | null>(null);
  const [isVerifying, setIsVerifying] = React.useState<boolean>(false);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);

  // Polling ref to prevent overlapping requests
  const isPollingRef = React.useRef(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // 1. Fetch Orders Function
  const fetchOrders = React.useCallback(async (isInitial = false) => {
    if (isPollingRef.current && !isInitial) return;
    isPollingRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`/api/shops/${shop.id}/orders?status=PLACED,CONFIRMED,PREPARING,READY,PICKED_UP,COMPLETED,REJECTED,CANCELLED`, {
        signal: controller.signal,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrders(data.data || []);
        setCurrentTimestamp(Date.now());
        setError(null);
      } else {
        if (isInitial) {
          setError(data.error?.message || "Failed to load order queue");
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        if (isInitial) setError("Network error while connecting to queue API");
      }
    } finally {
      setLoading(false);
      isPollingRef.current = false;
    }
  }, [shop.id]);

  // 2. Initial mount & 5s interval polling with unmount cleanup
  React.useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const res = await fetch(
          `/api/shops/${shop.id}/orders?status=PLACED,CONFIRMED,PREPARING,READY,PICKED_UP,COMPLETED,REJECTED,CANCELLED`
        );
        const data = await res.json();
        if (ignore) return;
        if (res.ok && data.success) {
          setOrders(data.data || []);
          setCurrentTimestamp(Date.now());
          setError(null);
        } else {
          setError(data.error?.message || "Failed to load order queue");
        }
      } catch {
        if (!ignore) setError("Network error while connecting to queue API");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    init();

    const interval = setInterval(() => {
      fetchOrders(false);
    }, 5000);

    return () => {
      ignore = true;
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchOrders, shop.id]);

  // 3. Action Handlers

  // Accept Order (PLACED -> CONFIRMED)
  const handleAcceptOrder = async (orderId: string) => {
    setActionInProgressOrderId(orderId);
    setActionError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchOrders(false);
      } else {
        setActionError(data.error?.message || "Failed to accept order");
      }
    } catch {
      setActionError("Network error while accepting order");
    } finally {
      setActionInProgressOrderId(null);
    }
  };

  // Advance Order Status (CONFIRMED -> PREPARING or PREPARING -> READY)
  const handleAdvanceOrder = async (orderId: string, targetStatus: "PREPARING" | "READY" | "COMPLETED") => {
    setActionInProgressOrderId(orderId);
    setActionError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchOrders(false);
      } else {
        setActionError(data.error?.message || `Failed to advance order to ${targetStatus}`);
      }
    } catch {
      setActionError("Network error while advancing order");
    } finally {
      setActionInProgressOrderId(null);
    }
  };

  // Reject Order Callback
  const handleConfirmReject = async (reason: ShopRejectionReasonType, note?: string) => {
    if (!rejectingOrder) return;
    setIsRejecting(true);
    setRejectError(null);
    try {
      const res = await fetch(`/api/orders/${rejectingOrder.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectionReason: reason,
          rejectionNote: note,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRejectingOrder(null);
        await fetchOrders(false);
      } else {
        setRejectError(data.error?.message || "Failed to reject order");
      }
    } catch {
      setRejectError("Network error while rejecting order");
    } finally {
      setIsRejecting(false);
    }
  };

  // Fast Pickup Handover Confirmation Callback (Visual match, no manual typing)
  const handleConfirmPickup = async () => {
    if (!verifyingOrder) return;
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch(`/api/orders/${verifyingOrder.id}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus: "PICKED_UP",
          pickupCode: verifyingOrder.orderNumber,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVerifyingOrder(null);
        await fetchOrders(false);
      } else {
        setVerifyError(data.error?.message || "Failed to confirm pickup handover");
        await fetchOrders(false);
      }
    } catch {
      setVerifyError("Network error while confirming pickup handover");
    } finally {
      setIsVerifying(false);
    }
  };

  // 4. Tab / Category Counts
  const placedOrders = React.useMemo(() => orders.filter((o) => o.status === "PLACED"), [orders]);
  const kitchenOrders = React.useMemo(
    () => orders.filter((o) => o.status === "CONFIRMED" || o.status === "PREPARING"),
    [orders]
  );
  const readyOrders = React.useMemo(() => orders.filter((o) => o.status === "READY"), [orders]);
  const historyOrders = React.useMemo(
    () => orders.filter((o) => ["PICKED_UP", "COMPLETED", "REJECTED", "CANCELLED"].includes(o.status)),
    [orders]
  );

  const activeOrders = React.useMemo(
    () => orders.filter((o) => ["PLACED", "CONFIRMED", "PREPARING", "READY"].includes(o.status)),
    [orders]
  );

  const displayedOrders = React.useMemo(() => {
    switch (activeTab) {
      case "placed":
        return placedOrders;
      case "kitchen":
        return kitchenOrders;
      case "ready":
        return readyOrders;
      case "history":
        return historyOrders;
      case "all_active":
      default:
        return activeOrders;
    }
  }, [activeTab, placedOrders, kitchenOrders, readyOrders, historyOrders, activeOrders]);

  // Visual-only elapsed time calculator (No timers or state mutations)
  const getElapsedMinutes = (placedAtIso: string): number => {
    if (!currentTimestamp) return 0;
    const placed = new Date(placedAtIso).getTime();
    return Math.max(0, Math.floor((currentTimestamp - placed) / (1000 * 60)));
  };

  return (
    <div className="space-y-6">
      {/* Top Queue Controls & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Live Fulfillment Queue
            </h1>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Live FIFO Sync
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active kitchen and counter fulfillment queue for <strong>{shop.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchOrders(false)}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Action Error Alert */}
      {actionError && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs Filter Bar */}
      <div className="flex border-b border-border gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("all_active")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === "all_active"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Filter className="size-3.5" />
          Active Orders
          <span className="rounded-full bg-background/20 px-1.5 py-0.2 text-[10px]">
            {activeOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("placed")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === "placed"
              ? "bg-amber-500 text-white shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Inbox className="size-3.5" />
          Incoming
          {placedOrders.length > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold">
              {placedOrders.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("kitchen")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === "kitchen"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <ChefHat className="size-3.5" />
          In Kitchen
          <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
            {kitchenOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ready")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === "ready"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <PackageCheck className="size-3.5" />
          Ready for Pickup
          {readyOrders.length > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold">
              {readyOrders.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === "history"
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Clock className="size-3.5" />
          Recent History ({historyOrders.length})
        </button>
      </div>

      {/* Main Queue Body */}
      {loading && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <RefreshCw className="size-8 text-primary animate-spin mb-3" />
          <p className="text-sm font-medium text-foreground">Loading queue orders...</p>
          <p className="text-xs text-muted-foreground mt-1">Connecting to kitchen order feed</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center">
          <AlertCircle className="size-8 text-destructive mx-auto mb-2" />
          <h2 className="text-sm font-semibold text-destructive">Could not load queue</h2>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchOrders(true)}
            className="mt-4 gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            Try Again
          </Button>
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted mx-auto text-muted-foreground mb-3">
            <CheckCircle2 className="size-6" />
          </div>
          <h2 className="text-base font-bold text-foreground">Queue is clear!</h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            {activeTab === "all_active"
              ? "There are currently no active orders in preparation or awaiting pickup."
              : `No orders in '${activeTab}' category right now.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayedOrders.map((order) => {
            const isActioning = actionInProgressOrderId === order.id;
            const elapsedMins = getElapsedMinutes(order.placedAt);
            const isLate = elapsedMins >= 5 && (order.status === "PLACED" || order.status === "CONFIRMED");
            const totalQuantity = order.items.reduce((acc, it) => acc + it.quantity, 0);

            return (
              <Card
                key={order.id}
                className={`flex flex-col justify-between transition-all duration-200 border-border/80 ${
                  order.status === "PLACED"
                    ? "ring-2 ring-amber-500/50 bg-amber-500/5 dark:bg-amber-950/10"
                    : order.status === "READY"
                    ? "ring-2 ring-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-950/10"
                    : ""
                }`}
              >
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-bold text-foreground tracking-tight">
                          #{order.orderNumber}
                        </span>
                        {/* Status Badge */}
                        <Badge
                          variant={
                            order.status === "PLACED"
                              ? "warning"
                              : order.status === "CONFIRMED"
                              ? "secondary"
                              : order.status === "PREPARING"
                              ? "default"
                              : order.status === "READY"
                              ? "success"
                              : order.status === "REJECTED" || order.status === "CANCELLED"
                              ? "destructive"
                              : "outline"
                          }
                          className="text-[11px] font-semibold uppercase tracking-wider"
                        >
                          {order.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <Clock className="size-3" />
                        <span>
                          {new Date(order.placedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="text-muted-foreground/60">•</span>
                        <span className={isLate ? "font-bold text-amber-600 dark:text-amber-400" : ""}>
                          {elapsedMins === 0 ? "Just now" : `${elapsedMins}m ago`}
                        </span>
                      </div>
                    </div>

                    {/* Order Total Overview in Header */}
                    <div className="text-right">
                      <div className="text-sm font-bold text-foreground font-mono">
                        {formatPriceINR(order.totalAmount)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {totalQuantity} {totalQuantity === 1 ? "item" : "items"}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="py-3.5 flex-1 space-y-3">
                  {/* Items List */}
                  <div className="space-y-2">
                    {order.items.map((item) => {
                      const productName = item.productNameSnapshot || item.productName || "Item";
                      const unitPrice = item.unitPriceSnapshot ?? item.unitPrice ?? 0;

                      return (
                        <div
                          key={item.id}
                          className="rounded-lg bg-muted/40 border border-border/50 p-2.5 space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-foreground">
                                  {productName}
                                </span>
                                <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">
                                  × {item.quantity}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {formatPriceINR(unitPrice)} each
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-bold text-sm text-foreground">
                                {formatPriceINR(item.subtotal)}
                              </span>
                            </div>
                          </div>

                          {item.specialInstructions && (
                            <div className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-xs text-amber-800 dark:text-amber-300 italic flex items-start gap-1.5">
                              <Sparkles className="size-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                              <span>
                                <strong className="font-semibold not-italic">Note:</strong>{" "}
                                {item.specialInstructions}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Total */}
                  <div className="rounded-lg bg-background/80 border border-border px-3 py-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">
                      Total: <strong className="text-foreground">{totalQuantity} {totalQuantity === 1 ? "item" : "items"}</strong>
                    </span>
                    <span className="font-mono font-extrabold text-sm text-foreground">
                      {formatPriceINR(order.totalAmount)}
                    </span>
                  </div>

                  {/* Mock Payment Disclaimer Badge */}
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] text-amber-800 dark:text-amber-300">
                    <div className="font-semibold flex items-center gap-1">
                      <Sparkles className="size-3" />
                      Mock Test Payment (Simulated)
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      No real currency collected. Safe campus test transaction.
                    </div>
                  </div>

                  {/* Rejection / Cancellation Reason Display (History) */}
                  {order.rejectionReason && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                      <span className="font-bold">Rejected:</span> {order.rejectionReason}
                      {order.rejectionNote && <div className="text-[11px] mt-0.5">{order.rejectionNote}</div>}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2 pb-4 border-t border-border/60 flex flex-col gap-2">
                  {/* Action Buttons depending on order status */}
                  {order.status === "PLACED" && (
                    <div className="flex items-center gap-2 w-full">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 text-xs"
                        disabled={isActioning}
                        onClick={() => {
                          setRejectError(null);
                          setRejectingOrder(order);
                        }}
                      >
                        <XCircle className="size-3.5 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={isActioning}
                        onClick={() => handleAcceptOrder(order.id)}
                      >
                        {isActioning ? (
                          <RefreshCw className="size-3.5 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="size-3.5 mr-1" />
                        )}
                        Accept Order
                      </Button>
                    </div>
                  )}

                  {order.status === "CONFIRMED" && (
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      disabled={isActioning}
                      onClick={() => handleAdvanceOrder(order.id, "PREPARING")}
                    >
                      {isActioning ? (
                        <RefreshCw className="size-3.5 animate-spin mr-1.5" />
                      ) : (
                        <ChefHat className="size-3.5 mr-1.5" />
                      )}
                      Start Preparation
                    </Button>
                  )}

                  {order.status === "PREPARING" && (
                    <Button
                      size="sm"
                      className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={isActioning}
                      onClick={() => handleAdvanceOrder(order.id, "READY")}
                    >
                      {isActioning ? (
                        <RefreshCw className="size-3.5 animate-spin mr-1.5" />
                      ) : (
                        <PackageCheck className="size-3.5 mr-1.5" />
                      )}
                      Mark Ready for Pickup
                    </Button>
                  )}

                  {order.status === "READY" && (
                    <Button
                      size="sm"
                      className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs gap-1.5"
                      disabled={isActioning}
                      onClick={() => {
                        setVerifyError(null);
                        setVerifyingOrder(order);
                      }}
                    >
                      <PackageCheck className="size-3.5" />
                      Verify Pickup
                    </Button>
                  )}

                  {order.status === "PICKED_UP" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      disabled={isActioning}
                      onClick={() => handleAdvanceOrder(order.id, "COMPLETED")}
                    >
                      {isActioning ? (
                        <RefreshCw className="size-3.5 animate-spin mr-1.5" />
                      ) : (
                        <CheckCircle2 className="size-3.5 mr-1.5" />
                      )}
                      Mark Completed
                    </Button>
                  )}

                  {["COMPLETED", "REJECTED", "CANCELLED"].includes(order.status) && (
                    <div className="w-full text-center text-[11px] text-muted-foreground py-1 font-medium">
                      Archived / Terminal Order
                    </div>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingOrder && (
        <RejectOrderModal
          isOpen={Boolean(rejectingOrder)}
          onClose={() => setRejectingOrder(null)}
          orderNumber={rejectingOrder.orderNumber}
          isRejecting={isRejecting}
          errorMessage={rejectError}
          onConfirmReject={handleConfirmReject}
        />
      )}

      {/* Pickup Verification Modal */}
      {verifyingOrder && (
        <PickupVerificationModal
          isOpen={Boolean(verifyingOrder)}
          onClose={() => setVerifyingOrder(null)}
          orderNumber={verifyingOrder.orderNumber}
          isVerifying={isVerifying}
          errorMessage={verifyError}
          onConfirmPickup={handleConfirmPickup}
        />
      )}
    </div>
  );
}
