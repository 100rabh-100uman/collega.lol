"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import {
  ArrowLeft,
  Store,
  AlertTriangle,
  RefreshCw,
  Check,
} from "lucide-react";

export default function NewShopPage() {
  const router = useRouter();

  // Form State
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [initialOwnerUserId, setInitialOwnerUserId] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [isOpen, setIsOpen] = React.useState(false);
  const [autoAcceptOrders, setAutoAcceptOrders] = React.useState(false);

  // Auto-slug sync flag
  const [isSlugTouched, setIsSlugTouched] = React.useState(false);

  // Submission State
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Auto slug generation from name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSlugTouched) {
      const generated = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Shop name is required.");
      return;
    }
    if (!slug.trim()) {
      setError("Shop slug is required.");
      return;
    }
    if (!location.trim()) {
      setError("Location is required.");
      return;
    }

    try {
      setSubmitting(true);

      // Attempt to resolve campusId from existing session context if needed
      let targetCampusId = "";
      const devRes = await fetch("/api/dev/session").catch(() => null);
      if (devRes && devRes.ok) {
        const devData = await devRes.json();
        targetCampusId = devData.data?.user?.campusId || "";
      }

      // If we don't have it from dev session, fetch from first shop or default seed campus
      if (!targetCampusId) {
        const shopsRes = await fetch("/api/admin/shops");
        const shopsData = await shopsRes.json();
        if (shopsRes.ok && shopsData.data && shopsData.data.length > 0) {
          targetCampusId = shopsData.data[0].campusId;
        }
      }

      // Fallback to recognized default seed campus if none found
      if (!targetCampusId) {
        targetCampusId = "00000001-0000-4000-8000-000000000001";
      }

      const payload: Record<string, unknown> = {
        campusId: targetCampusId,
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        location: location.trim(),
        description: description.trim() || null,
        isActive,
        isOpen,
        autoAcceptOrders,
      };

      if (initialOwnerUserId.trim()) {
        payload.initialOwnerUserId = initialOwnerUserId.trim();
      }

      const res = await fetch("/api/admin/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const newShopId = data.data.id;
        // If initial owner was not provided, navigate directly to member assignment screen
        if (!initialOwnerUserId.trim()) {
          router.push(`/admin/shops/${newShopId}/members?initial=true`);
        } else {
          router.push(`/admin/shops/${newShopId}`);
        }
      } else {
        setError(data.error?.message || "Failed to create shop.");
      }
    } catch {
      setError("Network error while creating shop.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back Link */}
      <div>
        <Link
          href="/admin/shops"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="size-3.5" />
          Back to Shop Directory
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Provision New Shop
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a campus dining kiosk, configure authoritative details, and optionally bootstrap an initial owner.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Store className="size-4 text-primary" />
              General Information
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Shop Name */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Shop Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Campus Corner Cafe"
                required
                className="w-full bg-background rounded-lg border border-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Shop Slug */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                URL Slug <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground font-mono bg-muted px-2.5 py-2 rounded-l-lg border border-r-0 border-input">
                  /shop/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setIsSlugTouched(true);
                    setSlug(e.target.value.toLowerCase().trim());
                  }}
                  placeholder="campus-corner-cafe"
                  required
                  pattern="^[a-z0-9-]+$"
                  title="Lowercase letters, numbers, and hyphens only"
                  className="w-full bg-background rounded-r-lg border border-input px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Must be unique within this campus. Used in student and staff URLs.
              </p>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Location Hint <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Student Center, Level 1 Food Court"
                required
                className="w-full bg-background rounded-lg border border-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Briefly describe what this shop serves..."
                className="w-full bg-background rounded-lg border border-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Initial Owner Bootstrap */}
            <div className="rounded-lg border border-border/80 bg-muted/30 p-4 space-y-2">
              <label className="block text-xs font-semibold text-foreground">
                Initial Owner User ID (Optional)
              </label>
              <input
                type="text"
                value={initialOwnerUserId}
                onChange={(e) => setInitialOwnerUserId(e.target.value)}
                placeholder="e.g. 00000000-0000-4000-a000-000000000001"
                className="w-full bg-background rounded-lg border border-input px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Provide an active user ID belonging to this campus to atomically assign them as the initial <strong>OWNER</strong>. If omitted, you will be prompted to assign an Owner immediately after creation.
              </p>
            </div>

            {/* Configuration Flags */}
            <div className="pt-2 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">Administrative Activation</div>
                  <div className="text-[11px] text-muted-foreground">
                    Inactive shops are completely hidden from student ordering discovery.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="size-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">Initial Operational State</div>
                  <div className="text-[11px] text-muted-foreground">
                    Whether the kiosk is open for orders immediately upon creation.
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
                    Automatically confirm orders upon placement without manual staff acceptance.
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
            <Button type="submit" size="sm" disabled={submitting} className="gap-1.5">
              {submitting ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Create Shop
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
