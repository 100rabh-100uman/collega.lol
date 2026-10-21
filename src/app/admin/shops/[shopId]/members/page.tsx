"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Users,
  UserPlus,
  ShieldAlert,
  Trash2,
  RefreshCw,
  Check,
  AlertTriangle,
  Crown,
  Briefcase,
} from "lucide-react";

interface MemberItem {
  id: string;
  shopId: string;
  userId: string;
  role: "OWNER" | "MANAGER" | "STAFF";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    role: string;
    campusId: string | null;
    isActive: boolean;
    profile?: {
      fullName?: string | null;
      phone?: string | null;
    } | null;
  };
}

function ShopMembersContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shopId = (params?.shopId as string) || "";
  const isInitialBootstrap = searchParams.get("initial") === "true";

  const [members, setMembers] = React.useState<MemberItem[]>([]);
  const [shopName, setShopName] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // New Member Form State
  const [newUserId, setNewUserId] = React.useState("");
  const [newRole, setNewRole] = React.useState<"OWNER" | "MANAGER" | "STAFF">("OWNER");
  const [assigning, setAssigning] = React.useState(false);

  // Member Action State
  const [actionInProgress, setActionInProgress] = React.useState<string | null>(null);

  const fetchMembersAndShop = React.useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch shop details for name
      const shopRes = await fetch(`/api/admin/shops/${shopId}`);
      const shopData = await shopRes.json();
      if (shopRes.ok && shopData.success) {
        setShopName(shopData.data.name);
      }

      // Fetch members
      const membersRes = await fetch(`/api/admin/shops/${shopId}/members`);
      const membersData = await membersRes.json();
      if (membersRes.ok && membersData.success) {
        setMembers(membersData.data || []);
      } else {
        setError(membersData.error?.message || "Failed to load shop members.");
      }
    } catch {
      setError("Network error while loading members.");
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  React.useEffect(() => {
    let ignore = false;
    async function load() {
      if (!shopId) return;
      try {
        setLoading(true);
        setError(null);

        const shopRes = await fetch(`/api/admin/shops/${shopId}`);
        const shopData = await shopRes.json();
        if (shopRes.ok && shopData.success && !ignore) {
          setShopName(shopData.data.name);
        }

        const membersRes = await fetch(`/api/admin/shops/${shopId}/members`);
        const membersData = await membersRes.json();
        if (ignore) return;
        if (membersRes.ok && membersData.success) {
          setMembers(membersData.data || []);
        } else {
          setError(membersData.error?.message || "Failed to load shop members.");
        }
      } catch {
        if (!ignore) setError("Network error while loading members.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [shopId]);

  // Handle Assign or Update Member
  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim()) {
      setError("Target User ID is required.");
      return;
    }

    try {
      setAssigning(true);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch(`/api/admin/shops/${shopId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: newUserId.trim(),
          role: newRole,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`Successfully assigned ${newRole} role to user.`);
        setNewUserId("");
        await fetchMembersAndShop();
      } else {
        setError(data.error?.message || "Failed to assign shop member.");
      }
    } catch {
      setError("Network error while assigning member.");
    } finally {
      setAssigning(false);
    }
  };

  // Handle Demotion / Role Change
  const handleChangeRole = async (userId: string, targetRole: "OWNER" | "MANAGER" | "STAFF") => {
    try {
      setActionInProgress(userId);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch(`/api/admin/shops/${shopId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          role: targetRole,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`Role successfully updated to ${targetRole}.`);
        await fetchMembersAndShop();
      } else {
        setError(data.error?.message || "Failed to update member role.");
      }
    } catch {
      setError("Network error while updating role.");
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Member Revocation
  const handleRevokeMember = async (memberId: string, memberRole: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to revoke this ${memberRole}'s access to this shop?`
    );
    if (!confirmed) return;

    try {
      setActionInProgress(memberId);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch(`/api/admin/shops/${shopId}/members/${memberId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage("Member access successfully revoked.");
        await fetchMembersAndShop();
      } else {
        setError(data.error?.message || "Failed to revoke member.");
      }
    } catch {
      setError("Network error while revoking member.");
    } finally {
      setActionInProgress(null);
    }
  };

  const activeOwners = members.filter((m) => m.role === "OWNER" && m.isActive);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Navigation & Header */}
      <div>
        <Link
          href={`/admin/shops/${shopId}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium mb-3"
        >
          <ArrowLeft className="size-3.5" />
          Back to Shop Details
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Shop Members & Roles
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {shopName ? `Managing authorized roles for "${shopName}"` : "Managing shop memberships"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMembersAndShop()}
            disabled={loading}
            className="gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Initial Bootstrap Alert */}
      {(isInitialBootstrap || activeOwners.length === 0) && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-50 dark:bg-rose-950/20 p-4 flex items-start gap-3">
          <ShieldAlert className="size-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 dark:text-rose-300 space-y-1">
            <span className="font-bold text-sm">Action Required: Initial Owner Assignment</span>
            <p className="leading-relaxed">
              Every shop must maintain at least one active <strong>OWNER</strong>. Assign an active user ID below to bootstrap initial ownership and unlock staff management.
            </p>
          </div>
        </div>
      )}

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

      {/* 1. Assign New Member Form */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserPlus className="size-4 text-primary" />
            Assign or Promote Shop Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAssignMember} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Target User ID <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 00000000-0000-4000-a000-000000000001"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  required
                  className="w-full bg-background rounded-lg border border-input px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Must be an active registered user belonging to this campus.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "OWNER" | "MANAGER" | "STAFF")}
                  className="w-full bg-background rounded-lg border border-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="OWNER">OWNER (Full Control)</option>
                  <option value="MANAGER">MANAGER (Menu & Operational)</option>
                  <option value="STAFF">STAFF (Fulfillment Only)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" disabled={assigning} className="gap-1.5">
                {assigning ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    Assign Member
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2. Current Members Table */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="size-4 text-primary" />
              Current Members ({members.length})
            </CardTitle>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Active Owners:</span>
              <Badge variant="outline" className="font-mono text-xs font-bold text-foreground">
                {activeOwners.length}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && members.length === 0 ? (
            <div className="p-8 text-center">
              <RefreshCw className="size-6 text-primary animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Loading members...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No members currently assigned to this shop.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {members.map((m) => {
                const isOnlyOwner = m.role === "OWNER" && activeOwners.length <= 1 && m.isActive;
                const isProcessing = actionInProgress === m.userId || actionInProgress === m.id;

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3 transition-colors ${
                      !m.isActive ? "opacity-50 bg-muted/20" : ""
                    }`}
                  >
                    {/* User Info */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {m.user.profile?.fullName || m.user.email}
                        </span>

                        {/* Role Badge */}
                        {m.role === "OWNER" && (
                          <Badge className="bg-purple-600/15 text-purple-700 dark:text-purple-400 border-purple-500/30 text-[10px] font-semibold gap-1">
                            <Crown className="size-3" />
                            OWNER
                          </Badge>
                        )}
                        {m.role === "MANAGER" && (
                          <Badge className="bg-blue-600/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] font-semibold gap-1">
                            <Briefcase className="size-3" />
                            MANAGER
                          </Badge>
                        )}
                        {m.role === "STAFF" && (
                          <Badge variant="outline" className="text-[10px] font-semibold">
                            STAFF
                          </Badge>
                        )}

                        {!m.isActive && (
                          <Badge variant="destructive" className="text-[10px]">
                            Revoked
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground font-mono">
                        <span>{m.user.email}</span>
                        <span>•</span>
                        <span>ID: {m.user.id}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {m.isActive && (
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Role Select */}
                        <select
                          value={m.role}
                          disabled={isProcessing}
                          onChange={(e) =>
                            handleChangeRole(
                              m.userId,
                              e.target.value as "OWNER" | "MANAGER" | "STAFF"
                            )
                          }
                          className="bg-background rounded border border-input text-xs px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          title={isOnlyOwner ? "Cannot demote the sole active Owner" : "Change role"}
                        >
                          <option value="OWNER">Owner</option>
                          <option value="MANAGER">Manager</option>
                          <option value="STAFF">Staff</option>
                        </select>

                        {/* Revoke Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => handleRevokeMember(m.id, m.role)}
                          className="h-8 px-2 text-destructive hover:bg-destructive/10"
                          title={isOnlyOwner ? "Cannot revoke the sole active Owner" : "Revoke membership"}
                        >
                          {isProcessing ? (
                            <RefreshCw className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ShopMembersPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <RefreshCw className="size-8 text-primary animate-spin mb-3" />
          <p className="text-sm font-medium text-foreground">Loading member management...</p>
        </div>
      }
    >
      <ShopMembersContent />
    </React.Suspense>
  );
}
