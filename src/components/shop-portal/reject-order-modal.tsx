"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, X } from "lucide-react";

export const SHOP_REJECTION_REASONS = [
  { value: "OUT_OF_STOCK", label: "Item(s) out of stock" },
  { value: "KITCHEN_OVERLOADED", label: "Kitchen overloaded / high backlog" },
  { value: "STORE_CLOSING_EARLY", label: "Shop closing early / maintenance" },
  { value: "ITEM_PRICE_MISMATCH", label: "Item price or recipe mismatch" },
  { value: "OTHER", label: "Other operational reason" },
] as const;

export type ShopRejectionReasonType = (typeof SHOP_REJECTION_REASONS)[number]["value"];

interface RejectOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  onConfirmReject: (reason: ShopRejectionReasonType, note?: string) => Promise<void>;
  isRejecting: boolean;
  errorMessage: string | null;
}

export function RejectOrderModal({
  isOpen,
  onClose,
  orderNumber,
  onConfirmReject,
  isRejecting,
  errorMessage,
}: RejectOrderModalProps) {
  const [reason, setReason] = React.useState<ShopRejectionReasonType>("OUT_OF_STOCK");
  const [note, setNote] = React.useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirmReject(reason, note.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-order-title"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <h2 id="reject-order-title" className="text-base font-bold text-foreground">
                Reject Order #{orderNumber}?
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                The student will be notified immediately. A structured reason is required.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRejecting}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="rejection-reason" className="text-xs font-semibold text-foreground">
              Rejection Reason <span className="text-destructive">*</span>
            </label>
            <select
              id="rejection-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as ShopRejectionReasonType)}
              disabled={isRejecting}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {SHOP_REJECTION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rejection-note" className="text-xs font-semibold text-foreground">
              Operational Note <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              id="rejection-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Ran out of burger buns. New shipment arrives at 3 PM."
              rows={3}
              maxLength={500}
              disabled={isRejecting}
              className="w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>
              Note: Simulated test payment transactions will be cancelled; no real money was collected.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isRejecting}
              className="gap-1.5"
            >
              {isRejecting ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Confirm Rejection"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
