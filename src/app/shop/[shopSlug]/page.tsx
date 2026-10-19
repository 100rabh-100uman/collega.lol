"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Store,
  MapPin,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Lock,
  Clock,
  ShieldAlert,
  LayoutDashboard,
} from "lucide-react";

interface PublicShopDetail {
  id: string;
  campusId: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  isOpen: boolean;
  autoAcceptOrders: boolean;
}

function PublicShopDetailContent() {
  const params = useParams();
  const router = useRouter();
  const shopSlug = (params?.shopSlug as string) || "";

  const [shop, setShop] = React.useState<PublicShopDetail | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [openingDashboard, setOpeningDashboard] = React.useState<boolean>(false);

  const handleOpenManagerDashboard = async () => {
    if (!shop) return;
    try {
      setOpeningDashboard(true);
      // In development, establish manager session cookie via existing dev session endpoint
      if (process.env.NODE_ENV !== "production") {
        await fetch("/api/dev/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "MANAGER" }),
        });
      }
      // Navigate to the existing manager dashboard with the selected shop context
      router.push(`/shop/dashboard?shopId=${encodeURIComponent(shop.id)}`);
    } catch {
      router.push(`/shop/dashboard?shopId=${encodeURIComponent(shop.id)}`);
    } finally {
      setOpeningDashboard(false);
    }
  };

  const fetchShopDetail = React.useCallback(async () => {
    if (!shopSlug) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/shops/public/${encodeURIComponent(shopSlug)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setShop(data.data);
        setError(null);
      } else {
        setError(data.error?.message || "Shop not found.");
      }
    } catch {
      setError("Network error fetching shop details.");
    } finally {
      setLoading(false);
    }
  }, [shopSlug]);

  React.useEffect(() => {
    let ignore = false;
    async function load() {
      if (!shopSlug) return;
      try {
        const res = await fetch(`/api/shops/public/${encodeURIComponent(shopSlug)}`);
        const data = await res.json();
        if (ignore) return;
        if (res.ok && data.success) {
          setShop(data.data);
          setError(null);
        } else {
          setError(data.error?.message || "Shop not found.");
        }
      } catch {
        if (!ignore) setError("Network error fetching shop details.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [shopSlug]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Public Header */}
      <header className="border-b border-border/80 bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/shop" className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="size-4" />
            <span>All Campus Shops</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 font-bold text-foreground">
            COLLEGA<span className="text-primary font-mono text-sm opacity-80">.LOL</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10 sm:py-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <RefreshCw className="size-8 text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">Loading shop details...</p>
          </div>
        ) : error || !shop ? (
          <div className="max-w-md mx-auto w-full py-16 text-center space-y-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mx-auto">
              <AlertTriangle className="size-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Shop Not Found</h2>
              <p className="text-xs text-muted-foreground">
                {error || "The requested campus shop could not be located."}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <Link href="/shop">
                <Button size="sm" variant="outline" className="text-xs">
                  Return to Directory
                </Button>
              </Link>
              <Button size="sm" onClick={fetchShopDetail} className="text-xs">
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Shop Hero Card */}
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
                    <Store className="size-7" />
                  </div>
                  <div className="space-y-1">
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                      {shop.name}
                    </h1>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <MapPin className="size-3.5 text-muted-foreground" />
                        <span>{shop.location || "Campus Kiosk"}</span>
                      </div>
                      <span>&bull;</span>
                      <div className="flex items-center gap-1">
                        <Clock className="size-3.5 text-muted-foreground" />
                        <span>Daily Campus Hours</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={`text-xs font-semibold py-1 px-3 self-start ${
                    shop.isOpen
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  <span
                    className={`size-2 rounded-full mr-2 inline-block ${
                      shop.isOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                    }`}
                  />
                  {shop.isOpen ? "Open for Orders" : "Orders Paused"}
                </Badge>
              </div>

              {shop.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {shop.description}
                </p>
              )}

              <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-4">
                <Link href="/shop">
                  <Button size="default" variant="outline" className="text-sm gap-2">
                    <ArrowLeft className="size-4" />
                    Back to Directory
                  </Button>
                </Link>
              </div>
            </div>

            {/* Shop Management Portal Section */}
            <Card className="border-border/80 bg-muted/20">
              <CardHeader className="p-6 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Lock className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      Shop Management Portal
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      For authorized shop owners, managers, and counter staff
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-4">
                <div className="rounded-xl border border-dashed border-border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold text-xs">
                      Manager / Owner Login — Coming Soon
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Authorized owners and managers will use this portal to access the operational dashboard, manage the menu and staff, and process live incoming orders. Dedicated manager authentication is currently in development.
                  </p>
                  <div className="pt-1">
                    <Button
                      size="default"
                      onClick={handleOpenManagerDashboard}
                      disabled={openingDashboard}
                      className="w-full sm:w-auto font-semibold gap-2 text-xs"
                    >
                      {openingDashboard ? (
                        <>
                          <RefreshCw className="size-3.5 animate-spin" />
                          <span>Opening Dashboard...</span>
                        </>
                      ) : (
                        <>
                          <LayoutDashboard className="size-3.5" />
                          <span>Open Manager Dashboard</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5 text-muted-foreground shrink-0" />
                  <span>Kitchen and counter staff members should use their dedicated mobile invitation link.</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground mt-auto">
        COLLEGA.LOL &copy; 2026 &bull; Campus Merchant Management & Operations
      </footer>
    </div>
  );
}

export default function PublicShopDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <p className="text-sm text-muted-foreground animate-pulse">Loading shop...</p>
        </div>
      }
    >
      <PublicShopDetailContent />
    </React.Suspense>
  );
}
