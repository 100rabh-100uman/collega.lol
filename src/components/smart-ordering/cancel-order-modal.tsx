"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { XCircle, RefreshCw, AlertTriangle } from "lucide-react";

export const CANCELLATION_REASONS = [
  { value: "WAIT_TIME_TOO_LONG", label: "Wait time is too long" },
  { value: "ORDERED_BY_MISTAKE", label: "Ordered by mistake" },
  { value: "VENDOR_UNRESPONSIVE", label: "Vendor is unresponsive" },
  { value: "OTHER", label: "Other reason" },
] as const;

export type CancellationReasonType = (typeof CANCELLATION_REASONS)[number]["value"];

interface CancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  onConfirmCancel: (reason: CancellationReasonType, note?: string) => Promise<void>;
  isCancelling: boolean;
  errorMessage: string | null;
}

export function CancelOrderModal({
  isOpen,
  onClose,
  orderNumber,
  onConfirmCancel,
  isCancelling,
  errorMessage,
}: CancelOrderModalProps) {
  const [reason, setReason] = React.useState<CancellationReasonType>("ORDERED_BY_MISTAKE");
  const [note, setNote] = React.useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirmCancel(reason, note.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-order-title"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="size-5" />
          </div>
          <div>
            <h2 id="cancel-order-title" className="text-base font-bold text-foreground">
              Cancel Order #{orderNumber}?
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Orders can only be cancelled while in <code className="font-mono">PLACED</code> status prior to kitchen acceptance.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Reason for Cancellation <span className="text-destructive">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as CancellationReasonType)}
              disabled={isCancelling}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {CANCELLATION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Additional Note (Optional &bull; Max 500 chars)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder="Provide any details for the shop staff..."
              disabled={isCancelling}
              rows={2}
              className="w-full rounded-lg border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground">
            <strong>Mock Payment Policy:</strong> Since this is a test order under simulated payment (<code className="font-mono">MOCK_TEST</code>), no monetary refund is initiated.
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isCancelling}
            >
              Keep Order
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isCancelling}
              className="gap-1.5"
            >
              {isCancelling ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Confirm Cancellation"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
