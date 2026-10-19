"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { formatPriceINR } from "@/lib/currency";
import {
  ShoppingBag,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Utensils,
} from "lucide-react";

export interface HistoryOrder {
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
  }>;
}

export function StudentOrderHistoryView() {
  const [orders, setOrders] = React.useState<HistoryOrder[]>([]);
  const [tab, setTab] = React.useState<"all" | "active">("all");
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState<number>(0);

  const triggerRefresh = React.useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  React.useEffect(() => {
    let ignore = false;

    async function loadOrders() {
      try {
        const url = tab === "active" ? "/api/orders?active=true" : "/api/orders";
        const res = await fetch(url, {
          headers: { "Content-Type": "application/json" },
        });

        if (ignore) return;

        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error?.message || "Failed to load order history");
        }

        const json = await res.json();
        if (ignore) return;

        if (json.success && Array.isArray(json.data)) {
          setOrders(json.data);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Error loading orders");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      ignore = true;
    };
  }, [tab, refreshKey]);

  const getStatusBadge = (status: HistoryOrder["status"]) => {
    switch (status) {
      case "PLACED":
        return <Badge variant="warning">Awaiting Shop</Badge>;
      case "CONFIRMED":
        return <Badge variant="default">Accepted &bull; In Queue</Badge>;
      case "PREPARING":
        return <Badge variant="default" className="bg-purple-600 dark:bg-purple-500">Preparing</Badge>;
      case "READY":
        return <Badge variant="success">Ready for Pickup</Badge>;
      case "PICKED_UP":
        return <Badge variant="success">Picked Up</Badge>;
      case "COMPLETED":
        return <Badge variant="outline">Completed</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingBag className="size-6 text-primary" />
            Your Campus Orders
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            View recent and past food kiosk orders with pickup status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
            <button
              onClick={() => setTab("all")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                tab === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Orders
            </button>
            <button
              onClick={() => setTab("active")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                tab === "active"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Active Only
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={triggerRefresh}
            disabled={loading}
            title="Refresh order history"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="border-destructive/30">
          <CardHeader className="p-4 flex flex-row items-center gap-3">
            <AlertCircle className="size-5 text-destructive shrink-0" />
            <div className="text-xs text-destructive font-medium flex-1">{error}</div>
            <Button size="xs" variant="outline" onClick={triggerRefresh}>
              Retry
            </Button>
          </CardHeader>
        </Card>
      )}

      {/* Orders List / Loading / Empty */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted/40 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ShoppingBag className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">No orders found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {tab === "active"
                  ? "You do not have any active orders right now."
                  : "You haven't placed any food kiosk orders yet."}
              </p>
            </div>
            <Link href="/order">
              <Button size="sm" className="mt-2 gap-1.5">
                <Utensils className="size-3.5" />
                Browse Campus Menu
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const itemCount = order.items.reduce((acc, item) => acc + item.quantity, 0);

            return (
              <Card
                key={order.id}
                className="hover:border-primary/40 transition-all shadow-xs overflow-hidden"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold font-mono text-primary">
                          #{order.orderNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">&bull;</span>
                        <span className="text-xs font-semibold text-foreground">
                          {order.shop.name}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Placed on {new Date(order.placedAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border/60 pt-3">
                    <div className="text-xs text-muted-foreground line-clamp-1 flex-1">
                      <span className="font-medium text-foreground">
                        {itemCount} item{itemCount === 1 ? "" : "s"}:
                      </span>{" "}
                      {order.items
                        .map((i) => `${i.quantity}x ${i.productNameSnapshot || i.productName || "Item"}`)
                        .join(", ")}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <div className="text-sm font-bold font-mono text-foreground">
                        {formatPriceINR(order.totalAmount)}
                      </div>

                      <Link href={`/order/${order.id}`}>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                          <span>Track</span>
                          <ArrowRight className="size-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
