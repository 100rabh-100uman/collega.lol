"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import {
  ArrowLeft,
  Power,
  SlidersHorizontal,
  Users,
  ShieldAlert,
  RefreshCw,
  Check,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

interface AdminShopDetail {
  id: string;
  campusId: string;
  name: string;
  slug: string;
  description: string | null;
  location: string;
  isActive: boolean;
  isOpen: boolean;
  autoAcceptOrders: boolean;
  createdAt: string;
  updatedAt: string;
  campus?: {
    id: string;
    name: string;
    slug: string;
  };
  members?: Array<{
    id: string;
    userId: string;
    role: "OWNER" | "MANAGER" | "STAFF";
    isActive: boolean;
    user: {
      id: string;
      email: string;
      role: string;
      profile?: {
        fullName?: string | null;
        phone?: string | null;
      } | null;
    };
  }>;
  _count?: {
    members: number;
    orders: number;
    products: number;
  };
}

export default function ShopDetailsPage() {
  const params = useParams();
  const shopId = (params?.shopId as string) || "";

  const [shop, setShop] = React.useState<AdminShopDetail | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Form Fields
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [autoAcceptOrders, setAutoAcceptOrders] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  // Submission States
  const [savingDetails, setSavingDetails] = React.useState(false);
  const [togglingActivation, setTogglingActivation] = React.useState(false);

  React.useEffect(() => {
    let ignore = false;
    async function load() {
      if (!shopId) return;
      try {
        const res = await fetch(`/api/admin/shops/${shopId}`);
        const data = await res.json();
        if (ignore) return;
        if (res.ok && data.success) {
          const s: AdminShopDetail = data.data;
          setShop(s);
          setName(s.name);
          setSlug(s.slug);
          setLocation(s.location);
          setDescription(s.description || "");
          setAutoAcceptOrders(s.autoAcceptOrders);
          setIsOpen(s.isOpen);
        } else {
          setError(data.error?.message || "Failed to load shop details.");
        }
      } catch {
        if (!ignore) setError("Network error loading shop details.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [shopId]);

  // Handle Administrative Activation Toggle
  const handleToggleActivation = async () => {
    if (!shop) return;
    const nextState = !shop.isActive;
    try {
      setTogglingActivation(true);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch(`/api/admin/shops/${shop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextState }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShop((prev) => (prev ? { ...prev, isActive: nextState } : null));
        setSuccessMessage(
          nextState
            ? "Shop has been administratively activated. It is now discoverable in the campus catalog."
            : "Shop has been administratively deactivated. Student ordering is halted."
        );
      } else {
        setError(data.error?.message || "Failed to update activation status.");
      }
    } catch {
      setError("Network error while updating activation status.");
    } finally {
      setTogglingActivation(false);
    }
  };

  // Handle Form Details Save
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    try {
      setSavingDetails(true);
      setError(null);
      setSuccessMessage(null);

      const payload = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        location: location.trim(),
        description: description.trim() || null,
        autoAcceptOrders,
        isOpen,
      };

      const res = await fetch(`/api/admin/shops/${shop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShop((prev) => (prev ? { ...prev, ...data.data } : null));
        setSuccessMessage("Shop metadata saved successfully.");
      } else {
        setError(data.error?.message || "Failed to save shop details.");
      }
    } catch {
      setError("Network error while saving details.");
    } finally {
      setSavingDetails(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <RefreshCw className="size-8 text-primary animate-spin mb-3" />
        <p className="text-sm font-medium text-foreground">Loading shop details...</p>
      </div>
    );
  }

  if (error && !shop) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center space-y-4">
        <ShieldAlert className="size-10 text-destructive mx-auto" />
        <h2 className="text-lg font-bold text-foreground">Unable to Load Shop</h2>
        <p className="text-sm text-destructive">{error}</p>
        <Link href="/admin/shops">
          <Button variant="outline" size="sm">
            Back to Directory
          </Button>
        </Link>
      </div>
    );
  }

  if (!shop) return null;

  const activeOwners = (shop.members || []).filter((m) => m.role === "OWNER" && m.isActive);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Navigation & Header */}
      <div>
        <Link
          href="/admin/shops"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium mb-3"
        >
          <ArrowLeft className="size-3.5" />
          Back to Shop Directory
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                {shop.name}
              </h1>
              {shop.isActive ? (
                <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
                  Active
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  Deactivated
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              Shop ID: {shop.id} • Campus: {shop.campus?.name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/admin/shops/${shop.id}/members`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Users className="size-4" />
                Manage Members ({shop.members?.length ?? 0})
              </Button>
            </Link>
            <Link href={`/shop/${shop.slug}`} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                Public Menu
                <ExternalLink className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <Check className="size-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 1. Administrative Activation Card */}
      <Card className={`border-2 ${shop.isActive ? "border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10" : "border-rose-500/40 bg-rose-50/20 dark:bg-rose-950/10"}`}>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Power className="size-5 text-primary" />
                Administrative Activation
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                Administrative activation is the authoritative platform control. Deactivating a shop overrides manager controls, hides the kiosk from the student dining directory, and halts all order checkouts.
              </p>
            </div>

            <Button
              onClick={handleToggleActivation}
              disabled={togglingActivation}
              variant={shop.isActive ? "destructive" : "default"}
              size="sm"
              className="gap-1.5 shrink-0"
            >
              {togglingActivation ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Updating...
                </>
              ) : shop.isActive ? (
                <>
                  <Power className="size-4" />
                  Deactivate Shop
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Activate Shop
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* 2. Owner Alert Banner (if no active owner) */}
      {activeOwners.length === 0 && (
        <div className="rounded-xl border border-rose-400 bg-rose-50 dark:bg-rose-950/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-sm">
            <ShieldAlert className="size-5 shrink-0" />
            <div>
              <span className="font-bold">No Active Owner Assigned!</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                This shop currently has zero active Owners. Shop managers cannot be added until an initial Owner is assigned.
              </p>
            </div>
          </div>
          <Link href={`/admin/shops/${shop.id}/members`}>
            <Button size="sm" variant="destructive" className="text-xs">
              Assign Owner
            </Button>
          </Link>
        </div>
      )}

      {/* 3. General Information Form */}
      <form onSubmit={handleSaveDetails}>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />
              General Metadata & Configuration
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Shop Name */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Shop Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-background rounded-lg border border-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Shop Slug */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  URL Slug
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
                  required
                  pattern="^[a-z0-9-]+$"
                  className="w-full bg-background rounded-lg border border-input px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Location Hint
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="w-full bg-background rounded-lg border border-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-background rounded-lg border border-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Operational Toggles */}
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">Operational Status (isOpen)</div>
                  <div className="text-[11px] text-muted-foreground">
                    Normal daily opening state (can also be toggled by shop owners and managers).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isOpen}
                  onChange={(e) => setIsOpen(e.target.checked)}
                  className="size-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">Auto-Accept Orders</div>
                  <div className="text-[11px] text-muted-foreground">
                    Automatically confirm incoming orders without staff interaction.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoAcceptOrders}
                  onChange={(e) => setAutoAcceptOrders(e.target.checked)}
                  className="size-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-border/80 pt-4">
            <Link href="/admin/shops">
              <Button type="button" variant="outline" size="sm">
                Cancel
              </Button>
            </Link>
            <Button type="submit" size="sm" disabled={savingDetails} className="gap-1.5">
              {savingDetails ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Save Changes
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
