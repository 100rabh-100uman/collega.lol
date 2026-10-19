"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, RefreshCw, X, PackageCheck } from "lucide-react";

interface PickupVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  isVerifying: boolean;
  errorMessage: string | null;
  onConfirmPickup: () => Promise<void>;
}

export function PickupVerificationModal({
  isOpen,
  onClose,
  orderNumber,
  isVerifying,
  errorMessage,
  onConfirmPickup,
}: PickupVerificationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pickup-verify-title"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PackageCheck className="size-6" />
            </div>
            <div>
              <h2 id="pickup-verify-title" className="text-base font-bold text-foreground">
                Verify Pickup Handover
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Staff visual confirmation for order handover
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isVerifying}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2.5">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="rounded-xl border border-border/80 bg-muted/30 p-5 text-center space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Order Number
          </div>
          <div className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-primary">
            #{orderNumber.replace(/^#/, "")}
          </div>
          <p className="text-sm font-semibold text-foreground pt-1">
            Confirm that the correct order is being handed over.
          </p>
          <p className="text-xs text-muted-foreground">
            Visually match this order number with the student&apos;s pickup screen before handing over the food.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onClose}
            disabled={isVerifying}
            className="flex-1 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="default"
            onClick={onConfirmPickup}
            disabled={isVerifying}
            className="flex-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Confirm Handover
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
