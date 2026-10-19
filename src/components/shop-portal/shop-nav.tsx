"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AuthorizedShop } from "./types";
import {
  Store,
  Layers,
  LayoutDashboard,
  Power,
  RefreshCw,
  AlertTriangle,
  UtensilsCrossed,
} from "lucide-react";

interface ShopNavProps {
  currentShop: AuthorizedShop | null;
  allShops: AuthorizedShop[];
  onSelectShop: (shopId: string) => void;
  onShopStatusToggled?: (isOpen: boolean) => void;
  devRole?: string;
  onDevRoleSwitched?: () => void;
}

export function ShopNav({
  currentShop,
  onShopStatusToggled,
}: ShopNavProps) {
  const pathname = usePathname();

  const [isTogglingStatus, setIsTogglingStatus] = React.useState(false);
  const [statusError, setStatusError] = React.useState<string | null>(null);

  // Shop pause / resume handler
  const handleToggleShopStatus = async () => {
    if (!currentShop) return;
    const canToggle = currentShop.role === "OWNER" || currentShop.role === "MANAGER";
    if (!canToggle) return;

    const nextState = !currentShop.isOpen;
    setIsTogglingStatus(true);
    setStatusError(null);

    try {
      const res = await fetch(`/api/shops/${currentShop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: nextState }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShopStatusToggled?.(nextState);
      } else {
        setStatusError(data.error?.message || "Failed to toggle shop status");
      }
    } catch {
      setStatusError("Network error while updating shop status");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const isQueueActive = pathname.startsWith("/shop/orders");
  const isDashboardActive = pathname.startsWith("/shop/dashboard");
  const isMenuActive = pathname.startsWith("/shop/menu");
  const isOwnerOrManager = currentShop?.role === "OWNER" || currentShop?.role === "MANAGER";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">

      {/* Main Navigation Bar */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          {/* Brand & Portal Title */}
          <Link href="/shop" className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-xs">
              <Store className="size-5" />
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-base font-bold text-foreground">
                COLLEGA<span className="text-primary font-mono text-xs opacity-80">.LOL</span>
              </div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Shop Staff Portal
              </div>
            </div>
          </Link>

          {/* Active Authorized Shop Info */}
          {currentShop ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-card/60 px-3 py-1.5 text-left">
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-foreground truncate max-w-[140px] sm:max-w-[200px]">
                    {currentShop.name}
                  </span>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 uppercase font-mono">
                    {currentShop.role}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <span
                    className={`inline-block size-1.5 rounded-full ${
                      currentShop.isOpen ? "bg-emerald-500 animate-pulse" : "bg-destructive"
                    }`}
                  />
                  {currentShop.isOpen ? "Accepting Orders" : "Orders Paused"}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Select a shop</div>
          )}

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href={currentShop ? `/shop/orders?shopId=${currentShop.id}` : "/shop/orders"}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isQueueActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Layers className="size-3.5" />
              Live Queue
            </Link>
            <Link
              href={currentShop ? `/shop/dashboard?shopId=${currentShop.id}` : "/shop/dashboard"}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isDashboardActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <LayoutDashboard className="size-3.5" />
              Dashboard
            </Link>
            {isOwnerOrManager && (
              <Link
                href={currentShop ? `/shop/menu?shopId=${currentShop.id}` : "/shop/menu"}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isMenuActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <UtensilsCrossed className="size-3.5" />
                Manage Menu
              </Link>
            )}
          </nav>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Pause / Resume Shop Toggle Button (Owner / Manager only) */}
          {currentShop && isOwnerOrManager && (
            <Button
              size="sm"
              variant={currentShop.isOpen ? "outline" : "destructive"}
              disabled={isTogglingStatus}
              onClick={handleToggleShopStatus}
              className="gap-1.5 text-xs"
              title={currentShop.isOpen ? "Pause new incoming orders" : "Resume accepting orders"}
            >
              {isTogglingStatus ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Power className="size-3.5" />
              )}
              <span className="hidden sm:inline">
                {currentShop.isOpen ? "Pause Orders" : "Resume Orders"}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Status Error Banner */}
      {statusError && (
        <div className="border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{statusError}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusError(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Mobile Sub-Navigation Links */}
      <div className="flex md:hidden border-t border-border/60 bg-muted/30 px-4 py-1.5 gap-2">
        <Link
          href={currentShop ? `/shop/orders?shopId=${currentShop.id}` : "/shop/orders"}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium ${
            isQueueActive ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
          }`}
        >
          <Layers className="size-3.5" />
          Queue
        </Link>
        <Link
          href={currentShop ? `/shop/dashboard?shopId=${currentShop.id}` : "/shop/dashboard"}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium ${
            isDashboardActive ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
          }`}
        >
          <LayoutDashboard className="size-3.5" />
          Dashboard
        </Link>
        {isOwnerOrManager && (
          <Link
            href={currentShop ? `/shop/menu?shopId=${currentShop.id}` : "/shop/menu"}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium ${
              isMenuActive ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
            }`}
          >
            <UtensilsCrossed className="size-3.5" />
            Menu
          </Link>
        )}
      </div>
    </header>
  );
}
