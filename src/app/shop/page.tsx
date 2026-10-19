"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import {
  Store,
  MapPin,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Lock,
} from "lucide-react";

interface PublicShop {
  id: string;
  campusId: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  isOpen: boolean;
  autoAcceptOrders: boolean;
}

export default function PublicShopDirectoryPage() {
  const [shops, setShops] = React.useState<PublicShop[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchPublicShops = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/shops/public");
      const data = await res.json();
      if (res.ok && data.success) {
        setShops(data.data || []);
        setError(null);
      } else {
        setError(data.error?.message || "Failed to load campus shops.");
      }
    } catch {
      setError("Network error connecting to campus shop directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/shops/public");
        const data = await res.json();
        if (ignore) return;
        if (res.ok && data.success) {
          setShops(data.data || []);
          setError(null);
        } else {
          setError(data.error?.message || "Failed to load campus shops.");
        }
      } catch {
        if (!ignore) setError("Network error connecting to campus shop directory.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Public Header */}
      <header className="border-b border-border/80 bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-xl font-bold tracking-tight text-foreground">
              COLLEGA<span className="text-primary font-mono text-sm opacity-80">.LOL</span>
            </span>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Merchant Portal
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Campus Merchant Directory
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10 sm:py-14">
        {/* Hero Section */}
        <div className="max-w-2xl space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Lock className="size-3.5 text-primary" />
            <span>Campus Merchant Directory</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Shop Management Directory
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Authorized portal for shop owners, managers, and counter staff. Select your shop to access operational dashboards, manage menus, and process incoming student orders.
          </p>
        </div>

        {/* State: Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <RefreshCw className="size-8 text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">Loading campus shops...</p>
            <p className="text-xs text-muted-foreground">Connecting to merchant directory</p>
          </div>
        ) : error ? (
          /* State: Error */
          <div className="max-w-md mx-auto w-full py-12">
            <Card className="border-destructive/30 bg-destructive/5 text-center p-6 space-y-4">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mx-auto">
                <AlertTriangle className="size-6" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-base font-bold text-foreground">
                  Unable to Load Merchant Directory
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {error}
                </p>
              </div>
              <Button size="sm" onClick={fetchPublicShops} className="text-xs gap-1.5 mx-auto">
                <RefreshCw className="size-3.5" />
                Retry Loading
              </Button>
            </Card>
          </div>
        ) : shops.length === 0 ? (
          /* State: Empty */
          <div className="max-w-md mx-auto w-full py-16 text-center space-y-3">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground mx-auto">
              <Store className="size-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">No Shops Available</h3>
              <p className="text-xs text-muted-foreground">
                There are currently no registered merchant locations for this campus.
              </p>
            </div>
          </div>
        ) : (
          /* State: Directory Grid */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Managed Campus Locations ({shops.length})
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
              {shops.map((shop) => (
                <Card
                  key={shop.id}
                  className="flex flex-col justify-between hover:border-primary/50 transition-all shadow-xs hover:shadow-sm"
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                          <Store className="size-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold text-foreground">
                            {shop.name}
                          </CardTitle>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                            <span>{shop.location || "Campus Kiosk"}</span>
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[11px] font-medium py-0.5 px-2 shrink-0 ${
                          shop.isOpen
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full mr-1.5 inline-block ${
                            shop.isOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                          }`}
                        />
                        {shop.isOpen ? "Open" : "Closed"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="px-5 py-2 text-xs text-muted-foreground">
                    <p className="line-clamp-2">
                      {shop.description ||
                        "Authorized campus dining establishment."}
                    </p>
                  </CardContent>

                  <CardFooter className="p-5 pt-3 border-t border-border/50">
                    <Link href={`/shop/${shop.slug}`} className="w-full">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs font-semibold gap-2 justify-center hover:bg-primary/5 hover:text-primary transition-colors"
                        title="Open shop management portal"
                      >
                        <Lock className="size-3.5 text-primary" />
                        <span>Manager / Owner Login</span>
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
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
