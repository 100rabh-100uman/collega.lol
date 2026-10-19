"use client";

import * as React from "react";
import Link from "next/link";
import { formatPriceINR, parsePriceToPaise, formatPaiseToINR } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { AuthorizedShop, QueueOrder } from "./types";
import {
  TrendingUp,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Power,
  MapPin,
  Sparkles,
  UtensilsCrossed,
  QrCode,
  Users,
} from "lucide-react";
import { ManageStaffSection } from "./manage-staff-section";

interface ShopDashboardViewProps {
  shop: AuthorizedShop;
}

export function ShopDashboardView({ shop }: ShopDashboardViewProps) {
  const [orders, setOrders] = React.useState<QueueOrder[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = React.useState<boolean>(false);
  const [isOpenState, setIsOpenState] = React.useState<boolean>(shop.isOpen);
  const [activeStaffCount, setActiveStaffCount] = React.useState<number>(0);
  const staffSectionRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/shops/${shop.id}/orders?status=PLACED,CONFIRMED,PREPARING,READY,PICKED_UP,COMPLETED,REJECTED,CANCELLED`
        );
        const data = await res.json();
        if (ignore) return;
        if (res.ok && data.success) {
          setOrders(data.data || []);
          setError(null);
        } else {
          setError(data.error?.message || "Failed to load dashboard data");
        }
      } catch {
        if (!ignore) setError("Network error connecting to shop orders API");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [shop.id]);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/shops/${shop.id}/orders?status=PLACED,CONFIRMED,PREPARING,READY,PICKED_UP,COMPLETED,REJECTED,CANCELLED`
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setOrders(data.data || []);
        setError(null);
      } else {
        setError(data.error?.message || "Failed to load dashboard data");
      }
    } catch {
      setError("Network error connecting to shop orders API");
    } finally {
      setLoading(false);
    }
  };

  // Pause / Resume Shop toggle
  const handleToggleShopStatus = async () => {
    const nextState = !isOpenState;
    setIsTogglingStatus(true);
    try {
      const res = await fetch(`/api/shops/${shop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: nextState }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsOpenState(nextState);
      }
    } catch {
      // Ignored
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Metrics computation
  const metrics = React.useMemo(() => {
    const placed = orders.filter((o) => o.status === "PLACED");
    const preparing = orders.filter((o) => o.status === "CONFIRMED" || o.status === "PREPARING");
    const ready = orders.filter((o) => o.status === "READY");
    const completed = orders.filter((o) => o.status === "PICKED_UP" || o.status === "COMPLETED");
    const rejected = orders.filter((o) => o.status === "REJECTED" || o.status === "CANCELLED");

    // Exact gross revenue from completed orders in paise
    const grossPaise = completed.reduce((sum, order) => {
      try {
        return sum + parsePriceToPaise(order.totalAmount);
      } catch {
        return sum;
      }
    }, 0);

    return {
      totalOrders: orders.length,
      placedCount: placed.length,
      preparingCount: preparing.length,
      readyCount: ready.length,
      completedCount: completed.length,
      rejectedCount: rejected.length,
      activeCount: placed.length + preparing.length + ready.length,
      grossRevenueFormatted: formatPaiseToINR(grossPaise),
    };
  }, [orders]);

  const isOwnerOrManager = shop.role === "OWNER" || shop.role === "MANAGER";

  return (
    <div className="space-y-6">
      {/* Header Overview Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {shop.name}
            </h1>
            <Badge variant="outline" className="font-mono text-xs uppercase">
              {shop.role}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <MapPin className="size-3.5" />
            <span>{shop.location || "Campus Kiosk"}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span
                className={`size-2 rounded-full ${
                  isOpenState ? "bg-emerald-500 animate-pulse" : "bg-destructive"
                }`}
              />
              {isOpenState ? "Open & Accepting Orders" : "Orders Paused"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwnerOrManager && (
            <Button
              size="sm"
              variant={isOpenState ? "outline" : "destructive"}
              disabled={isTogglingStatus}
              onClick={handleToggleShopStatus}
              className="gap-1.5 text-xs"
            >
              {isTogglingStatus ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Power className="size-3.5" />
              )}
              {isOpenState ? "Pause Orders" : "Resume Orders"}
            </Button>
          )}

          {isOwnerOrManager && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => staffSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="gap-1.5 text-xs"
            >
              <Users className="size-3.5" />
              Manage Staff
            </Button>
          )}

          {isOwnerOrManager && (
            <Link href={`/shop/menu?shopId=${shop.id}`}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <UtensilsCrossed className="size-3.5" />
                Manage Menu
              </Button>
            </Link>
          )}

          <Link href={`/shop/orders?shopId=${shop.id}`}>
            <Button size="sm" className="gap-1.5 text-xs">
              <Layers className="size-3.5" />
              Open Live Queue
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Connected Staff Counter */}
        <Card className={activeStaffCount > 0 ? "border-emerald-500/40 bg-emerald-500/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Connected Staff
            </CardTitle>
            <Users className={`size-4 ${activeStaffCount > 0 ? "text-emerald-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              Active Staff: {activeStaffCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {activeStaffCount === 0
                ? "No mobile staff connected"
                : `${activeStaffCount} active counter shift${activeStaffCount === 1 ? "" : "s"}`}
            </p>
          </CardContent>
        </Card>
        {/* Active Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Active Fulfillment Queue
            </CardTitle>
            <Layers className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.activeCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {metrics.placedCount} incoming, {metrics.preparingCount} cooking, {metrics.readyCount} ready
            </p>
          </CardContent>
        </Card>

        {/* Incoming / Placed */}
        <Card className={metrics.placedCount > 0 ? "border-amber-500/40 bg-amber-500/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Pending Acceptance
            </CardTitle>
            <Clock className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.placedCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Awaiting staff confirmation
            </p>
          </CardContent>
        </Card>

        {/* Completed Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Completed Handed Over
            </CardTitle>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.completedCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {metrics.rejectedCount} cancelled/rejected
            </p>
          </CardContent>
        </Card>

        {/* Simulated Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Simulated Gross Volume
            </CardTitle>
            <TrendingUp className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.grossRevenueFormatted}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              From {metrics.completedCount} completed orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Operational Notice Banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary shrink-0" />
          <span>
            <strong>Simulated Campus Ordering:</strong> All payments are safely processed via mock test gateway. No real currency is collected.
          </span>
        </div>
        <Link href={`/shop/orders?shopId=${shop.id}`}>
          <Button size="sm" variant="outline" className="text-xs h-7">
            Manage Orders
          </Button>
        </Link>
      </div>

      {/* In-Shop Counter QR Ordering Placeholder Card (Section 7) */}
      <Card className="border-border/80 bg-gradient-to-br from-card to-muted/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <QrCode className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-foreground">
                In-Shop Counter QR Ordering
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Direct in-person student catalog access via printed counter QR code.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-semibold border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
          >
            Coming Soon
          </Badge>
        </CardHeader>
        <CardContent className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <p className="max-w-xl">
            This future feature will let students quickly scan a shop counter QR code from their mobile browser to immediately open this shop&apos;s ordering menu without browsing the campus catalog.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled
            className="text-xs shrink-0 cursor-not-allowed opacity-60"
          >
            <QrCode className="size-3.5 mr-1.5" />
            Generate Counter QR
          </Button>
        </CardContent>
      </Card>

      {/* Manage Staff Section */}
      <div ref={staffSectionRef}>
        <ManageStaffSection
          shopId={shop.id}
          shopName={shop.name}
          isOwnerOrManager={isOwnerOrManager}
          onActiveCountChange={setActiveStaffCount}
        />
      </div>

      {/* Recent Orders Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold">Recent Orders Activity</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Summary of recent orders processed through the shop queue.
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={loading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading && orders.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" />
              Loading orders...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-xs text-destructive">
              <AlertCircle className="size-5 mx-auto mb-1" />
              {error}
            </div>
          ) : orders.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No orders have been placed for this shop yet.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {orders.slice(0, 8).map((order) => (
                <div
                  key={order.id}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-foreground">
                      #{order.orderNumber}
                    </span>
                    <Badge
                      variant={
                        order.status === "PLACED"
                          ? "warning"
                          : order.status === "CONFIRMED" || order.status === "PREPARING"
                          ? "default"
                          : order.status === "READY"
                          ? "success"
                          : order.status === "REJECTED" || order.status === "CANCELLED"
                          ? "destructive"
                          : "outline"
                      }
                      className="text-[10px] uppercase font-semibold"
                    >
                      {order.status}
                    </Badge>
                    <span className="text-muted-foreground hidden sm:inline">
                      {order.items.map((i) => `${i.quantity}× ${i.productNameSnapshot || i.productName || "Item"}`).join(", ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-bold text-foreground font-mono">
                      {formatPriceINR(order.totalAmount)}
                    </span>
                    <span className="text-muted-foreground text-[11px] hidden md:inline">
                      {new Date(order.placedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
