"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPriceINR, parsePriceToPaise } from "@/lib/currency";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";

export interface MismatchItem {
  productId: string;
  productName: string;
  expectedPrice: string;
  actualPrice: string;
}

interface PriceMismatchModalProps {
  isOpen: boolean;
  mismatches: MismatchItem[];
  onAccept: (mismatches: MismatchItem[]) => void;
  onCancel: () => void;
}

export function PriceMismatchModal({
  isOpen,
  mismatches,
  onAccept,
  onCancel,
}: PriceMismatchModalProps) {
  if (!isOpen || mismatches.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-mismatch-title"
      >
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-1">
            <h2 id="price-mismatch-title" className="text-lg font-bold tracking-tight text-foreground">
              Price Changes Detected (HTTP 409)
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The server verified that item prices have been updated since they were added to your cart.
              Under our authoritative pricing policy, you must explicitly confirm the current prices to proceed.
            </p>
          </div>
        </div>

        {/* List of Mismatched Products */}
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4 max-h-60 overflow-y-auto">
          {mismatches.map((item) => {
            const expPaise = parsePriceToPaise(item.expectedPrice);
            const actPaise = parsePriceToPaise(item.actualPrice);
            const diffPaise = actPaise - expPaise;
            const isIncrease = diffPaise > 0;

            return (
              <div
                key={item.productId}
                className="flex items-center justify-between gap-3 text-sm py-2 border-b border-border/50 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground truncate">{item.productName}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span className="line-through">{formatPriceINR(item.expectedPrice)}</span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span className="font-semibold text-foreground font-mono">
                      {formatPriceINR(item.actualPrice)}
                    </span>
                  </div>
                </div>

                <div>
                  <Badge variant={isIncrease ? "destructive" : "success"} className="text-[10px] font-mono">
                    {isIncrease ? `+${formatPriceINR(diffPaise / 100)}` : `-${formatPriceINR(Math.abs(diffPaise) / 100)}`}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          Confirming will update your cart items to the server-authoritative prices and recalculate the exact order total.
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel & Return to Cart
          </Button>
          <Button onClick={() => onAccept(mismatches)} className="gap-1.5">
            <Check className="size-4" />
            Accept Updated Prices & Re-verify
          </Button>
        </div>
      </div>
    </div>
  );
}
