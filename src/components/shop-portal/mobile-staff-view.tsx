"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatPriceINR } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { QueueOrder } from "./types";
import {
  Smartphone,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  ChefHat,
  PackageCheck,
  Check,
  X,
  MessageSquare,
} from "lucide-react";

interface StaffSessionData {
  id: string;
  shopId: string;
  staffLabel: string;
  shopName: string;
  expiresAt: string;
}

export function MobileStaffView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL invitation token if scanned via QR
  const tokenFromUrl = searchParams.get("token") || "";

  const [invitationToken, setInvitationToken] = React.useState<string>(tokenFromUrl);
  const [pinCode, setPinCode] = React.useState<string>("");
  const [isRedeeming, setIsRedeeming] = React.useState<boolean>(false);
  const [redemptionError, setRedemptionError] = React.useState<string | null>(null);

  // Active Session State
  const [activeSession, setActiveSession] = React.useState<StaffSessionData | null>(null);
  const [isCheckingSession, setIsCheckingSession] = React.useState<boolean>(true);
  const [isRevoked, setIsRevoked] = React.useState<boolean>(false);

  // Orders Queue State
  const [orders, setOrders] = React.useState<QueueOrder[]>([]);
  const [activeTab, setActiveTab] = React.useState<"ALL" | "PLACED" | "PREPARING" | "READY">("ALL");
  const [isLoadingOrders, setIsLoadingOrders] = React.useState<boolean>(false);
  const [orderActionLoading, setOrderActionLoading] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Modal states for Reject and Pickup
  const [rejectingOrder, setRejectingOrder] = React.useState<QueueOrder | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState<string>("");

  const [verifyingPickupOrder, setVerifyingPickupOrder] = React.useState<QueueOrder | null>(null);
  const [pickupCodeInput, setPickupCodeInput] = React.useState<string>("");
  const [pickupError, setPickupError] = React.useState<string | null>(null);

  // 1. Initial Session Check (check if staff cookie is already valid)
  React.useEffect(() => {
    let ignore = false;
    async function checkExistingSession() {
      try {
        const res = await fetch("/api/staff/session");
        const data = await res.json();
        if (ignore) return;
        if (res.ok && data.success && data.data?.active && data.data?.staffSession) {
          setActiveSession(data.data.staffSession);
          setIsRevoked(false);
        }
      } catch {
        // Fallback to unredeemed state
      } finally {
        if (!ignore) setIsCheckingSession(false);
      }
    }
    checkExistingSession();
    return () => {
      ignore = true;
    };
  }, []);

  // 2. Fetch Orders for authorized staff shop
  const fetchOrders = React.useCallback(async () => {
    if (!activeSession) return;
    try {
      const res = await fetch(`/api/shops/${activeSession.shopId}/orders`);
      const data = await res.json();
      if (res.ok && data.success) {
        setOrders(data.data || []);
        setActionError(null);
      } else if (res.status === 401 || res.status === 403) {
        // Session was revoked on server
        setIsRevoked(true);
        setActiveSession(null);
      }
    } catch {
      // Ignored during background polling
    } finally {
      setIsLoadingOrders(false);
    }
  }, [activeSession]);

  // 3. Heartbeat / Session Check (detects manager revocation in real-time)
  React.useEffect(() => {
    if (!activeSession) return;

    let ignore = false;
    const loadQueue = async () => {
      try {
        const res = await fetch(`/api/shops/${activeSession.shopId}/orders`);
        const data = await res.json();
        if (!ignore && res.ok && data.success) {
          setOrders(data.data || []);
          setActionError(null);
        } else if (!ignore && (res.status === 401 || res.status === 403)) {
          setIsRevoked(true);
          setActiveSession(null);
        }
      } catch {
        // Ignored
      } finally {
        if (!ignore) setIsLoadingOrders(false);
      }
    };
    void loadQueue();

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/staff/session");
        const data = await res.json();
        if (!res.ok || !data.data?.active) {
          setIsRevoked(true);
          setActiveSession(null);
          return;
        }
        // If still active, fetch latest queue orders
        await fetchOrders();
      } catch {
        // Network blip
      }
    }, 6000); // 6-second heartbeat

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [activeSession, fetchOrders]);

  // Handle invitation redemption
  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitationToken.trim()) {
      setRedemptionError("Please enter or scan the staff invitation token");
      return;
    }
    const cleanCode = pinCode.replace(/\D/g, "");
    if (cleanCode.length !== 10) {
      setRedemptionError("Please enter the complete 10-digit verification PIN");
      return;
    }

    setIsRedeeming(true);
    setRedemptionError(null);

    try {
      const res = await fetch("/api/staff/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: invitationToken.trim(),
          code: cleanCode,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActiveSession({
          id: data.data.sessionId,
          shopId: data.data.shopId,
          staffLabel: data.data.staffLabel,
          shopName: data.data.shopName,
          expiresAt: data.data.expiresAt,
        });
        setIsRevoked(false);
        setIsLoadingOrders(true);
      } else {
        setRedemptionError(data.error?.message || "Invalid invitation token or code");
      }
    } catch {
      setRedemptionError("Network error while connecting to server");
    } finally {
      setIsRedeeming(false);
    }
  };

  // Staff Logout / End Shift
  const handleEndShift = async () => {
    if (!confirm("Are you sure you want to end your counter shift?")) return;
    try {
      await fetch("/api/staff/logout", { method: "POST" });
    } catch {
      // Ignored
    }
    setActiveSession(null);
    setPinCode("");
    setInvitationToken("");
    router.push("/staff");
  };

  // Order Actions
  const handleAcceptOrder = async (orderId: string) => {
    setOrderActionLoading(orderId);
    setActionError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchOrders();
      } else if (res.status === 401 || res.status === 403) {
        setIsRevoked(true);
        setActiveSession(null);
      } else {
        setActionError(data.error?.message || "Failed to accept order");
      }
    } catch {
      setActionError("Network error while accepting order");
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingOrder) return;
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason for the student.");
      return;
    }

    setOrderActionLoading(rejectingOrder.id);
    try {
      const res = await fetch(`/api/orders/${rejectingOrder.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRejectingOrder(null);
        setRejectionReason("");
        await fetchOrders();
      } else if (res.status === 401 || res.status === 403) {
        setIsRevoked(true);
        setActiveSession(null);
      } else {
        alert(data.error?.message || "Failed to reject order");
      }
    } catch {
      alert("Network error while rejecting order");
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleAdvanceOrder = async (orderId: string, targetStatus: string) => {
    setOrderActionLoading(orderId);
    setActionError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchOrders();
      } else if (res.status === 401 || res.status === 403) {
        setIsRevoked(true);
        setActiveSession(null);
      } else {
        setActionError(data.error?.message || "Failed to advance order");
      }
    } catch {
      setActionError("Network error while advancing order");
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleConfirmPickup = async () => {
    if (!verifyingPickupOrder) return;
    setOrderActionLoading(verifyingPickupOrder.id);
    setPickupError(null);

    try {
      const res = await fetch(`/api/orders/${verifyingPickupOrder.id}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus: "PICKED_UP",
          pickupCode: pickupCodeInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setVerifyingPickupOrder(null);
        setPickupCodeInput("");
        await fetchOrders();
      } else if (res.status === 401 || res.status === 403) {
        setIsRevoked(true);
        setActiveSession(null);
      } else {
        setPickupError(data.error?.message || "Invalid pickup code");
      }
    } catch {
      setPickupError("Network error while verifying pickup");
    } finally {
      setOrderActionLoading(null);
    }
  };

  // Filtered orders
  const filteredOrders = React.useMemo(() => {
    if (activeTab === "ALL") return orders;
    if (activeTab === "PLACED") return orders.filter((o) => o.status === "PLACED");
    if (activeTab === "PREPARING") {
      return orders.filter((o) => o.status === "CONFIRMED" || o.status === "PREPARING");
    }
    if (activeTab === "READY") return orders.filter((o) => o.status === "READY");
    return orders;
  }, [orders, activeTab]);

  const placedCount = orders.filter((o) => o.status === "PLACED").length;
  const preparingCount = orders.filter(
    (o) => o.status === "CONFIRMED" || o.status === "PREPARING"
  ).length;
  const readyCount = orders.filter((o) => o.status === "READY").length;

  // --- STATE 1: Initial Loading ---
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="size-8 animate-spin mx-auto text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            Connecting to counter terminal...
          </p>
        </div>
      </div>
    );
  }

  // --- STATE 2: Access Revoked by Manager ---
  if (isRevoked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-destructive/40 bg-card p-6 text-center space-y-4 shadow-xl">
          <div className="p-4 rounded-full bg-destructive/10 text-destructive size-16 mx-auto flex items-center justify-center">
            <ShieldAlert className="size-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground">Staff Access Revoked</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your staff counter shift session has been ended by the shop manager or has expired. Subsequent API requests are blocked.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => {
                setIsRevoked(false);
                setPinCode("");
                setInvitationToken("");
                router.push("/staff");
              }}
              className="w-full text-xs font-semibold"
            >
              Enter New Invitation
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // --- STATE 3: Unredeemed / Enter 10-Digit PIN Screen ---
  if (!activeSession) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-background p-4 sm:p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="size-14 rounded-2xl bg-primary text-primary-foreground font-black text-xl flex items-center justify-center mx-auto shadow-md">
              <Smartphone className="size-7" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Counter Staff Access
            </h1>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Scan the counter QR code from your manager or enter the 10-digit verification PIN below.
            </p>
          </div>

          {/* Verification Form Card */}
          <Card className="border-border shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <KeyRound className="size-4 text-primary" />
                Staff Verification
              </CardTitle>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleRedeem} className="space-y-4">
                {redemptionError && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span className="font-medium">{redemptionError}</span>
                  </div>
                )}

                {/* Invitation Token Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Invitation Token
                  </label>
                  <input
                    type="text"
                    value={invitationToken}
                    onChange={(e) => setInvitationToken(e.target.value)}
                    placeholder="Enter or paste invitation token"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {tokenFromUrl && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="size-3" />
                      Loaded from scanned QR link
                    </p>
                  )}
                </div>

                {/* 10-Digit Code Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    10-Digit Staff Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 5832941029"
                    className="w-full rounded-lg border border-input bg-background px-3 py-3 text-xl font-mono font-bold tracking-widest text-center text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-[11px] text-muted-foreground text-center">
                    Enter the 10 digits provided by your shop manager
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isRedeeming || !invitationToken || pinCode.length !== 10}
                  className="w-full h-11 text-sm font-bold gap-2 shadow-md"
                >
                  {isRedeeming ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Verifying PIN...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-4" />
                      Start Counter Shift
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Security Note */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-muted-foreground text-center">
            <p className="text-[11px] leading-relaxed">
              Staff access is strictly restricted to order fulfillment for your assigned shop. Manager settings and prices cannot be modified from counter terminals.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- STATE 4: Active Counter Queue Experience ---
  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      {/* Sticky Mobile Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between gap-3 max-w-3xl mx-auto">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-base font-bold text-foreground truncate">
                {activeSession.shopName}
              </h1>
            </div>
            <p className="text-xs text-muted-foreground font-medium truncate">
              {activeSession.staffLabel} &bull; Counter Queue
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="xs"
              variant="outline"
              onClick={fetchOrders}
              disabled={isLoadingOrders}
              className="h-8 gap-1 text-xs"
            >
              <RefreshCw className={`size-3.5 ${isLoadingOrders ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              size="xs"
              variant="ghost"
              onClick={handleEndShift}
              className="h-8 text-destructive hover:bg-destructive/10 text-xs gap-1"
            >
              <LogOut className="size-3.5" />
              End Shift
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {actionError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2.5">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{actionError}</div>
          </div>
        )}

        {/* Status Filter Tabs (Touch Friendly) */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-muted/60 border border-border rounded-xl">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`py-2 px-1 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "ALL"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab("PLACED")}
            className={`py-2 px-1 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === "PLACED"
                ? "bg-amber-500 text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>New</span>
            {placedCount > 0 && (
              <span className="size-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                {placedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("PREPARING")}
            className={`py-2 px-1 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === "PREPARING"
                ? "bg-primary text-primary-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Prep</span>
            {preparingCount > 0 && (
              <span className="size-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                {preparingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("READY")}
            className={`py-2 px-1 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === "READY"
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Ready</span>
            {readyCount > 0 && (
              <span className="size-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                {readyCount}
              </span>
            )}
          </button>
        </div>

        {/* Orders Queue List */}
        {filteredOrders.length === 0 ? (
          <div className="py-16 text-center space-y-3 rounded-2xl border border-dashed border-border p-6 bg-card">
            <div className="p-3.5 rounded-full bg-muted text-muted-foreground size-14 mx-auto flex items-center justify-center">
              <PackageCheck className="size-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Queue is Clear</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                No orders currently in this state. New orders will appear automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const orderDate = new Date(order.placedAt || 0);
              const isActionLoading = orderActionLoading === order.id;

              return (
                <Card
                  key={order.id}
                  className={`overflow-hidden border transition-all ${
                    order.status === "PLACED"
                      ? "border-amber-500/50 shadow-sm"
                      : order.status === "READY"
                      ? "border-emerald-500/50 shadow-sm"
                      : "border-border shadow-xs"
                  }`}
                >
                  <CardHeader className="p-4 pb-2 bg-muted/20 border-b border-border/50 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-black text-foreground">
                        {order.orderNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        &bull;{" "}
                        {orderDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div>
                      {order.status === "PLACED" && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs font-bold">
                          NEW ORDER
                        </Badge>
                      )}
                      {order.status === "CONFIRMED" && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs font-bold">
                          CONFIRMED
                        </Badge>
                      )}
                      {order.status === "PREPARING" && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs font-bold">
                          IN PREP
                        </Badge>
                      )}
                      {order.status === "READY" && (
                        <Badge variant="success" className="text-xs font-bold">
                          READY FOR PICKUP
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-4">
                    {/* Items List */}
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between text-xs gap-2"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-foreground">
                                {item.productNameSnapshot || item.productName || "Item"}
                              </span>
                              <span className="font-mono font-black text-primary px-1.5 py-0.2 rounded bg-primary/10">
                                × {item.quantity}
                              </span>
                            </div>
                            {item.specialInstructions && (
                              <div className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded">
                                <MessageSquare className="size-3 shrink-0" />
                                <span>Note: {item.specialInstructions}</span>
                              </div>
                            )}
                          </div>

                          <span className="font-mono font-medium text-muted-foreground">
                            {formatPriceINR(item.unitPriceSnapshot ?? item.unitPrice ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Order Total & Item Count */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                      <span className="text-muted-foreground">
                        {order.items.reduce((s, i) => s + i.quantity, 0)} items total
                      </span>
                      <span className="font-mono text-sm font-bold text-foreground">
                        {formatPriceINR(order.totalAmount)}
                      </span>
                    </div>

                    {/* Touch Friendly Action Buttons */}
                    <div className="pt-1">
                      {order.status === "PLACED" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isActionLoading}
                            onClick={() => {
                              setRejectingOrder(order);
                              setRejectionReason("");
                            }}
                            className="h-10 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 font-semibold"
                          >
                            <X className="size-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            disabled={isActionLoading}
                            onClick={() => handleAcceptOrder(order.id)}
                            className="h-10 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {isActionLoading ? (
                              <RefreshCw className="size-4 animate-spin" />
                            ) : (
                              <Check className="size-4" />
                            )}
                            Accept Order
                          </Button>
                        </div>
                      )}

                      {order.status === "CONFIRMED" && (
                        <Button
                          size="sm"
                          disabled={isActionLoading}
                          onClick={() => handleAdvanceOrder(order.id, "PREPARING")}
                          className="w-full h-11 text-xs font-bold gap-2"
                        >
                          {isActionLoading ? (
                            <RefreshCw className="size-4 animate-spin" />
                          ) : (
                            <ChefHat className="size-4" />
                          )}
                          Start Cooking
                        </Button>
                      )}

                      {order.status === "PREPARING" && (
                        <Button
                          size="sm"
                          disabled={isActionLoading}
                          onClick={() => handleAdvanceOrder(order.id, "READY")}
                          className="w-full h-11 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {isActionLoading ? (
                            <RefreshCw className="size-4 animate-spin" />
                          ) : (
                            <PackageCheck className="size-4" />
                          )}
                          Mark Ready for Pickup
                        </Button>
                      )}

                      {order.status === "READY" && (
                        <Button
                          size="sm"
                          disabled={isActionLoading}
                          onClick={() => {
                            setVerifyingPickupOrder(order);
                            setPickupCodeInput("");
                            setPickupError(null);
                          }}
                          className="w-full h-11 text-xs font-bold gap-2 shadow-sm"
                        >
                          <CheckCircle2 className="size-4" />
                          Verify Student Pickup
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Reject Order Reason Modal */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setRejectingOrder(null)}
          />

          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-bold text-foreground">
                Reject Order {rejectingOrder.orderNumber}
              </h3>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setRejectingOrder(null)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground block">
                Reason for Rejection (Displayed to student)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Ingredients ran out, shop closing soon"
                rows={3}
                className="w-full rounded-lg border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRejectingOrder(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!rejectionReason.trim()}
                onClick={handleConfirmReject}
                className="text-xs font-bold"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pickup Verification Modal */}
      {verifyingPickupOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setVerifyingPickupOrder(null)}
          />

          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-1">
              <div className="p-3 rounded-full bg-primary/10 text-primary size-12 mx-auto flex items-center justify-center">
                <PackageCheck className="size-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">
                Verify Counter Pickup
              </h3>
              <p className="text-xs text-muted-foreground">
                Ask student for Order Number or Pickup Code
              </p>
            </div>

            {pickupError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive text-center">
                {pickupError}
              </div>
            )}

            <div className="space-y-2">
              <input
                type="text"
                autoFocus
                value={pickupCodeInput}
                onChange={(e) => setPickupCodeInput(e.target.value)}
                placeholder={verifyingPickupOrder.orderNumber}
                className="w-full rounded-xl border border-input bg-background p-3 text-center text-lg font-mono font-bold tracking-wider text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground text-center">
                Expected code: <strong className="font-mono">{verifyingPickupOrder.orderNumber}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setVerifyingPickupOrder(null)}
                className="flex-1 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!pickupCodeInput.trim()}
                onClick={handleConfirmPickup}
                className="flex-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Confirm Pickup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
