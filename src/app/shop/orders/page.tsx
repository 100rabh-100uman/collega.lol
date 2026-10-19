"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShopNav } from "@/components/shop-portal/shop-nav";
import { FulfillmentQueueView } from "@/components/shop-portal/fulfillment-queue-view";
import type { AuthorizedShop } from "@/components/shop-portal/types";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function ShopOrdersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryShopId = searchParams.get("shopId");

  const [shops, setShops] = React.useState<AuthorizedShop[]>([]);
  const [selectedShopId, setSelectedShopId] = React.useState<string | null>(queryShopId);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchShops = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/shops/memberships");
      const data = await res.json();
      if (res.ok && data.success) {
        const list: AuthorizedShop[] = data.data || [];
        setShops(list);
        if (list.length > 0) {
          const matched = list.find((s) => s.id === queryShopId);
          setSelectedShopId(matched ? matched.id : list[0].id);
        } else {
          setSelectedShopId(null);
        }
        setError(null);
      } else {
        setError(data.error?.message || "Unauthorized access. Staff membership required.");
      }
    } catch {
      setError("Network error fetching shop memberships.");
    } finally {
      setLoading(false);
    }
  }, [queryShopId]);

  React.useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/shops/memberships");
        const data = await res.json();
        if (ignore) return;
        if (res.ok && data.success) {
          const list: AuthorizedShop[] = data.data || [];
          setShops(list);
          if (list.length > 0) {
            const matched = list.find((s) => s.id === queryShopId);
            setSelectedShopId(matched ? matched.id : list[0].id);
          } else {
            setSelectedShopId(null);
          }
          setError(null);
        } else {
          setError(data.error?.message || "Unauthorized access. Staff membership required.");
        }
      } catch {
        if (!ignore) setError("Network error fetching shop memberships.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [queryShopId]);

  const currentShop = React.useMemo(() => {
    return shops.find((s) => s.id === selectedShopId) || null;
  }, [shops, selectedShopId]);

  const handleSelectShop = (shopId: string) => {
    setSelectedShopId(shopId);
    router.push(`/shop/orders?shopId=${shopId}`);
  };

  const handleShopStatusToggled = (isOpen: boolean) => {
    setShops((prev) =>
      prev.map((s) => (s.id === selectedShopId ? { ...s, isOpen } : s))
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <RefreshCw className="size-8 text-primary animate-spin mb-3" />
        <p className="text-sm font-medium text-foreground">Loading shop fulfillment queue...</p>
      </div>
    );
  }

  if (error || !currentShop) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border/80 bg-background px-6 h-16 flex items-center">
          <Link href="/shop" className="text-sm font-bold text-foreground">
            COLLEGA.LOL Staff Portal
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-4">
            <ShieldAlert className="size-10 text-destructive mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Shop Access Required</h2>
            <p className="text-xs text-muted-foreground">
              {error || "You do not have active staff membership for this shop."}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link href="/shop">
                <Button size="sm" variant="outline" className="text-xs">
                  Return to Portal Entry
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ShopNav
        currentShop={currentShop}
        allShops={shops}
        onSelectShop={handleSelectShop}
        onShopStatusToggled={handleShopStatusToggled}
        onDevRoleSwitched={fetchShops}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-6 sm:py-8">
        <FulfillmentQueueView shop={currentShop} />
      </main>
    </div>
  );
}

export default function ShopOrdersPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
          <RefreshCw className="size-8 text-primary animate-spin mb-3" />
          <p className="text-sm font-medium text-foreground">Connecting to shop workspace...</p>
        </div>
      }
    >
      <ShopOrdersContent />
    </React.Suspense>
  );
}
