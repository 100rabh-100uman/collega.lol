"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Users,
  QrCode,
  KeyRound,
  ShieldAlert,
  Trash2,
  RefreshCw,
  Plus,
  AlertTriangle,
  X,
  Copy,
  Check,
  Smartphone,
} from "lucide-react";

export interface StaffSessionItem {
  id: string;
  shopId: string;
  staffLabel: string;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string | null;
}

export interface StaffInvitationItem {
  id: string;
  shopId: string;
  expiresAt: string;
  createdAt: string;
  attempts: number;
}

interface ManageStaffSectionProps {
  shopId: string;
  shopName: string;
  isOwnerOrManager: boolean;
  onActiveCountChange?: (count: number) => void;
}

export function ManageStaffSection({
  shopId,
  shopName,
  isOwnerOrManager,
  onActiveCountChange,
}: ManageStaffSectionProps) {
  const [sessions, setSessions] = React.useState<StaffSessionItem[]>([]);
  const [pendingInvitations, setPendingInvitations] = React.useState<StaffInvitationItem[]>([]);
  const [activeCount, setActiveCount] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Invitation creation modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState<boolean>(false);
  const [isGenerating, setIsGenerating] = React.useState<boolean>(false);
  const [generatedInvite, setGeneratedInvite] = React.useState<{
    id: string;
    invitationToken: string;
    code: string;
    expiresAt: string;
    qrDataUrl?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = React.useState<boolean>(false);
  const [copiedCode, setCopiedCode] = React.useState<boolean>(false);

  // Session revocation confirmation state
  const [sessionToRevoke, setSessionToRevoke] = React.useState<StaffSessionItem | null>(null);
  const [isRevoking, setIsRevoking] = React.useState<boolean>(false);

  const fetchStaffData = React.useCallback(async () => {
    if (!isOwnerOrManager) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/shops/${shopId}/staff/sessions`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSessions(data.data.sessions || []);
        setPendingInvitations(data.data.pendingInvitations || []);
        setActiveCount(data.data.activeStaffCount || 0);
        onActiveCountChange?.(data.data.activeStaffCount || 0);
        setError(null);
      } else {
        setError(data.error?.message || "Failed to load staff sessions");
      }
    } catch {
      setError("Network error while loading staff access");
    } finally {
      setLoading(false);
    }
  }, [shopId, isOwnerOrManager, onActiveCountChange]);

  React.useEffect(() => {
    let ignore = false;
    const init = async () => {
      if (!isOwnerOrManager) return;
      try {
        const res = await fetch(`/api/shops/${shopId}/staff/sessions`);
        const data = await res.json();
        if (!ignore && res.ok && data.success) {
          setSessions(data.data.sessions || []);
          setPendingInvitations(data.data.pendingInvitations || []);
          setActiveCount(data.data.activeStaffCount || 0);
          onActiveCountChange?.(data.data.activeStaffCount || 0);
        }
      } catch {
        // Ignored
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    void init();

    // Periodic refresh every 10 seconds for real-time manager visibility
    const interval = setInterval(fetchStaffData, 10000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [shopId, isOwnerOrManager, fetchStaffData, onActiveCountChange]);

  // Handle invitation generation
  const handleGenerateInvitation = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/shops/${shopId}/staff/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiryMinutes: 15 }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const invite = data.data;
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const qrTargetUrl = `${origin}/staff?token=${invite.invitationToken}`;
        const qrDataUrl = await QRCode.toDataURL(qrTargetUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });

        setGeneratedInvite({
          ...invite,
          qrDataUrl,
        });
        fetchStaffData();
      } else {
        setError(data.error?.message || "Failed to generate staff invitation");
      }
    } catch {
      setError("Network error while generating invitation");
    } finally {
      setIsGenerating(false);
    }
  };

  // Revoke active staff session
  const handleConfirmRevokeSession = async () => {
    if (!sessionToRevoke) return;
    setIsRevoking(true);
    try {
      const res = await fetch(
        `/api/shops/${shopId}/staff/sessions/${sessionToRevoke.id}/revoke`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setSessionToRevoke(null);
        await fetchStaffData();
      } else {
        setError(data.error?.message || "Failed to revoke staff session");
      }
    } catch {
      setError("Network error while revoking staff session");
    } finally {
      setIsRevoking(false);
    }
  };

  // Revoke pending invitation
  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(
        `/api/shops/${shopId}/staff/invitations/${invitationId}/revoke`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchStaffData();
      }
    } catch {
      // Ignored
    }
  };

  if (!isOwnerOrManager) {
    return null;
  }

  return (
    <Card className="border-border shadow-xs">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">
              Manage Staff & Counter Devices
            </CardTitle>
            <Badge
              variant={activeCount > 0 ? "success" : "muted"}
              className="font-mono text-xs px-2 py-0.5"
            >
              Active Staff: {activeCount}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Authorizes phone-based counter staff to fulfill orders for {shopName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchStaffData}
            disabled={loading}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setGeneratedInvite(null);
              setIsInviteModalOpen(true);
            }}
            className="text-xs h-8 gap-1.5 font-semibold"
          >
            <Plus className="size-3.5" />
            Invite Staff Member
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Active Staff Sessions Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Currently Authorized Staff Sessions ({sessions.length})
          </h4>

          {loading && sessions.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              <RefreshCw className="size-4 animate-spin mx-auto mb-1 text-primary" />
              Loading staff sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              <Smartphone className="size-6 mx-auto mb-1.5 text-muted-foreground/60" />
              <p className="font-medium text-foreground">No active staff connected</p>
              <p className="mt-0.5">
                Generate an invitation above to grant mobile counter access to staff.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border bg-card/50 overflow-hidden">
              {sessions.map((sess) => {
                const connectedDate = new Date(sess.createdAt);
                const expiryDate = new Date(sess.expiresAt);

                return (
                  <div
                    key={sess.id}
                    className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{sess.staffLabel}</span>
                        <Badge variant="success" className="text-[10px] py-0 px-1.5">
                          Active
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          Connected:{" "}
                          <strong className="text-foreground">
                            {connectedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Shift Expiry:{" "}
                          <strong className="text-foreground">
                            {expiryDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </strong>
                        </span>
                        {sess.lastActiveAt && (
                          <>
                            <span>•</span>
                            <span>
                              Last Action:{" "}
                              {new Date(sess.lastActiveAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => setSessionToRevoke(sess)}
                        className="text-xs gap-1 font-medium"
                      >
                        <Trash2 className="size-3" />
                        Remove Access
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Pending Unredeemed Invitations */}
        {pendingInvitations.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/60">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Invitations ({pendingInvitations.length})
            </h4>

            <div className="divide-y divide-border rounded-lg border border-border/80 bg-muted/10 overflow-hidden text-xs">
              {pendingInvitations.map((inv) => {
                const expDate = new Date(inv.expiresAt);
                return (
                  <div
                    key={inv.id}
                    className="p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          Invitation #{inv.id.slice(0, 8)}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0">
                          Expires at {expDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {inv.attempts > 0 ? `${inv.attempts} failed attempt(s)` : "Awaiting scan & PIN entry"}
                      </p>
                    </div>

                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => handleRevokeInvitation(inv.id)}
                      className="text-destructive hover:bg-destructive/10 text-xs h-7"
                    >
                      Revoke
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      {/* Staff Invitation Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsInviteModalOpen(false)}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <QrCode className="size-5 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">
                    Staff Counter Invitation
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Valid for 15 minutes. Single-use only.
                </p>
              </div>

              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setIsInviteModalOpen(false)}
                aria-label="Close"
              >
                <X className="size-4" />
              </Button>
            </div>

            {!generatedInvite ? (
              <div className="space-y-4 py-4 text-center">
                <div className="p-4 rounded-xl bg-primary/10 text-primary w-16 h-16 mx-auto flex items-center justify-center">
                  <Smartphone className="size-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    Ready to Generate Mobile Staff Access
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    This will create a scannable QR code and a separate 10-digit PIN. The staff member scans the QR with their phone and enters the PIN to connect.
                  </p>
                </div>
                <Button
                  onClick={handleGenerateInvitation}
                  disabled={isGenerating}
                  className="w-full gap-2 font-bold"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Generating Secure Invitation...
                    </>
                  ) : (
                    <>
                      <KeyRound className="size-4" />
                      Generate Invitation Now
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-muted/20">
                  {generatedInvite.qrDataUrl ? (
                    <img
                      src={generatedInvite.qrDataUrl}
                      alt="Staff Invitation QR Code"
                      className="size-48 rounded-lg shadow-sm bg-white p-2"
                    />
                  ) : (
                    <div className="size-48 bg-muted animate-pulse rounded-lg" />
                  )}
                  <p className="text-[11px] text-muted-foreground mt-2 font-medium">
                    Scan with camera to open /staff on mobile
                  </p>
                </div>

                {/* 10-Digit Code Display */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    10-Digit Verification Code
                  </span>
                  <div className="font-mono text-2xl font-black tracking-widest text-primary">
                    {generatedInvite.code.slice(0, 3)} {generatedInvite.code.slice(3, 6)}{" "}
                    {generatedInvite.code.slice(6, 10)}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Enter this PIN on the counter mobile page after scanning
                  </p>
                </div>

                {/* Security Disclosure Notice */}
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <p className="leading-snug">
                    <strong>Dual-Factor Protection:</strong> The 10-digit code is never embedded into the QR payload or link. It must be entered manually by the staff member.
                  </p>
                </div>

                {/* Copy Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const origin = typeof window !== "undefined" ? window.location.origin : "";
                      navigator.clipboard.writeText(
                        `${origin}/staff?token=${generatedInvite.invitationToken}`
                      );
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="flex-1 text-xs gap-1.5"
                  >
                    {copiedLink ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    {copiedLink ? "Link Copied" : "Copy QR Link"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInvite.code);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="flex-1 text-xs gap-1.5"
                  >
                    {copiedCode ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    {copiedCode ? "PIN Copied" : "Copy PIN"}
                  </Button>
                </div>

                <Button
                  onClick={() => setIsInviteModalOpen(false)}
                  className="w-full text-xs font-semibold"
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal to Revoke Staff Session */}
      {sessionToRevoke && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => !isRevoking && setSessionToRevoke(null)}
          />

          <div className="relative w-full max-w-sm rounded-2xl border border-destructive/40 bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Remove Staff Access?
                </h3>
                <p className="text-xs text-muted-foreground">
                  Terminate session for {sessionToRevoke.staffLabel}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              This staff member&apos;s active session will be immediately revoked on the server. Subsequent API requests will fail, and their counter screen will be redirected to an Access Revoked notification.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                disabled={isRevoking}
                onClick={() => setSessionToRevoke(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isRevoking}
                onClick={handleConfirmRevokeSession}
                className="text-xs gap-1.5 font-bold"
              >
                {isRevoking ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    Revoking...
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    Confirm Revoke
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
