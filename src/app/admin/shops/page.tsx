"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Store,
  Plus,
  Search,
  Users,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";

interface AdminShopItem {
  id: string;
  campusId: string;
  name: string;
  slug: string;
  description: string | null;
  location: string;
  isActive: boolean;
  isOpen: boolean;
  autoAcceptOrders: boolean;
  campus?: {
    id: string;
    name: string;
    slug: string;
  };
  members?: Array<{
    id: string;
    user: {
      id: string;
      email: string;
      profile?: {
        fullName?: string | null;
      } | null;
    };
  }>;
  _count?: {
    members: number;
    orders: number;
  };
}

export default function AdminShopsPage() {
  const [shops, setShops] = React.useState<AdminShopItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("all");

  const fetchShops = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/shops?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setShops(data.data || []);
      } else {
        setError(data.error?.message || "Failed to load campus shops.");
      }
    } catch {
      setError("Network error while connecting to administrative directory.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  React.useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        if (statusFilter !== "all") params.set("status", statusFilter);

        const res = await fetch(`/api/admin/shops?${params.toString()}`);
        const data = await res.json();
        if (ignore) return;
        if (res.ok && data.success) {
          setShops(data.data || []);
        } else {
          setError(data.error?.message || "Failed to load campus shops.");
        }
      } catch {
        if (!ignore) setError("Network error while connecting to administrative directory.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [searchQuery, statusFilter]);

  // Summary counts
  const totalCount = shops.length;
  const activeCount = shops.filter((s) => s.isActive).length;
  const inactiveCount = shops.filter((s) => !s.isActive).length;
  const openCount = shops.filter((s) => s.isOpen && s.isActive).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Campus Shops
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage food kiosks, administrative activation, operational opening, and authorized shop owners.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchShops()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/admin/shops/new">
            <Button size="sm" className="gap-1.5 shadow-xs">
              <Plus className="size-4" />
              New Shop
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Total Shops</div>
          <div className="mt-1 text-2xl font-bold text-foreground">{totalCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Administratively Active</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {activeCount}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Deactivated</div>
          <div className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {inactiveCount}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Currently Open</div>
          <div className="mt-1 text-2xl font-bold text-primary">{openCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by shop name, slug, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background rounded-lg border border-input pl-9 pr-4 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
            className="text-xs h-8"
          >
            All
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "active" ? "default" : "outline"}
            onClick={() => setStatusFilter("active")}
            className="text-xs h-8"
          >
            Active Only
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "inactive" ? "default" : "outline"}
            onClick={() => setStatusFilter("inactive")}
            className="text-xs h-8"
          >
            Deactivated
          </Button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => fetchShops()}>
            Try Again
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && shops.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-border/60 bg-card/50 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && shops.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <Store className="size-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No shops found</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            {searchQuery || statusFilter !== "all"
              ? "No campus shops matched your search criteria. Try resetting the filters."
              : "No shops are registered under this campus yet. Create the first shop to begin."}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {(searchQuery || statusFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                Reset Filters
              </Button>
            )}
            <Link href="/admin/shops/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="size-4" />
                Create First Shop
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Shop Directory Grid / List */}
      <div className="grid gap-3">
        {shops.map((shop) => {
          const owners = shop.members || [];
          const hasOwner = owners.length > 0;
          const primaryOwner = owners[0]?.user;

          return (
            <div
              key={shop.id}
              className={`rounded-xl border transition-all p-5 bg-card hover:border-primary/40 shadow-2xs ${
                !shop.isActive ? "border-rose-300 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10" : "border-border"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Shop Info */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground truncate">
                      {shop.name}
                    </h3>
                    <span className="font-mono text-xs text-muted-foreground bg-muted/70 px-2 py-0.5 rounded">
                      /{shop.slug}
                    </span>

                    {/* Status Badges */}
                    {shop.isActive ? (
                      <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-semibold">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[11px] font-semibold">
                        Deactivated
                      </Badge>
                    )}

                    {shop.isActive && (
                      shop.isOpen ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[11px]">
                          Open
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-500/30 text-[11px]">
                          Closed
                        </Badge>
                      )
                    )}

                    {shop.autoAcceptOrders && (
                      <Badge variant="secondary" className="text-[10px]">
                        Auto-Accept
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5 text-muted-foreground/80" />
                      {shop.location}
                    </span>
                    {shop.campus && (
                      <span>• {shop.campus.name}</span>
                    )}
                  </div>

                  {/* Owner Status */}
                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <span className="text-muted-foreground">Owner:</span>
                    {hasOwner ? (
                      <span className="font-medium text-foreground flex items-center gap-1">
                        <ShieldCheck className="size-3.5 text-emerald-600" />
                        {primaryOwner?.profile?.fullName || primaryOwner?.email}
                        {owners.length > 1 && (
                          <span className="text-muted-foreground text-[10px]">
                            (+{owners.length - 1} more)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 font-semibold bg-rose-100 dark:bg-rose-950/40 px-2 py-0.5 rounded">
                        <ShieldAlert className="size-3.5" />
                        No Owner Assigned
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link href={`/admin/shops/${shop.id}/members`}>
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                      <Users className="size-3.5" />
                      Members ({shop._count?.members ?? 0})
                    </Button>
                  </Link>

                  <Link href={`/admin/shops/${shop.id}`}>
                    <Button variant="default" size="sm" className="gap-1.5 h-8 text-xs">
                      <SlidersHorizontal className="size-3.5" />
                      Edit & Activation
                    </Button>
                  </Link>

                  <Link href={`/shop/${shop.slug}`} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="sm" className="size-8 p-0" title="View Public Menu">
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
