"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Store,
  Plus,
  ArrowUpRight,
  School,
  ExternalLink,
} from "lucide-react";

interface AdminNavProps {
  userRole?: string;
  campusName?: string;
}

export function AdminNav({
  userRole = "CAMPUS_ADMIN",
  campusName,
}: AdminNavProps) {
  const pathname = usePathname();

  const isDirectoryActive = pathname === "/admin/shops" || pathname === "/admin";
  const isNewShopActive = pathname === "/admin/shops/new";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: Brand & Portal Badge */}
        <div className="flex items-center gap-6">
          <Link href="/admin/shops" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-xs">
              <Shield className="size-5" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-bold text-foreground">
                COLLEGA<span className="text-primary font-mono text-xs opacity-80">.LOL</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                  Admin Console
                </span>
                <span className="text-[10px] text-muted-foreground">•</span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 uppercase font-mono font-bold border-primary/30 text-primary"
                >
                  {userRole}
                </Badge>
              </div>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              href="/admin/shops"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                isDirectoryActive
                  ? "bg-accent text-accent-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Store className="size-4" />
              Shop Directory
            </Link>
            <Link
              href="/admin/shops/new"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                isNewShopActive
                  ? "bg-accent text-accent-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Plus className="size-4" />
              New Shop
            </Link>
          </nav>
        </div>

        {/* Right: Campus Scope & Portals Switcher */}
        <div className="flex items-center gap-3">
          {campusName && (
            <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <School className="size-3.5 text-primary" />
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {campusName}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Link href="/shop" target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
                Merchant Portal
                <ArrowUpRight className="size-3 opacity-70" />
              </Button>
            </Link>
            <Link href="/order/shops" target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
                Dining
                <ExternalLink className="size-3 opacity-70" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
