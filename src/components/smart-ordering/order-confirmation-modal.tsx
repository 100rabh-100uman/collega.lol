"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPriceINR } from "@/lib/currency";
import {
  CheckCircle2,
  ArrowRight,
  Info,
  MapPin,
} from "lucide-react";

export interface ConfirmedOrderItem {
  id: string;
  orderId?: string;
  productId?: string | null;
  productNameSnapshot?: string;
  unitPriceSnapshot?: string | number;
  quantity: number;
  subtotal?: string | number;
  specialInstructions?: string | null;
  productName?: string;
  unitPrice?: string | number;
}

export interface ConfirmedOrderData {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string | number;
  currency?: string;
  shop: {
    id: string;
    name: string;
    location: string | null;
    slug?: string;
  };
  items: ConfirmedOrderItem[];
  payments?: Array<{
    id?: string;
    amount?: string | number;
    provider?: string;
    status?: string;
  }>;
  statusHistory?: Array<unknown>;
}

interface OrderConfirmationModalProps {
  isOpen: boolean;
  order: ConfirmedOrderData | null;
  onClose: () => void;
}

export function OrderConfirmationModal({
  isOpen,
  order,
  onClose,
}: OrderConfirmationModalProps) {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-confirmation-title"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-8" />
          </div>
          <h2 id="order-confirmation-title" className="text-xl font-bold tracking-tight text-foreground">
            Order Placed Successfully!
          </h2>
          <p className="text-xs text-muted-foreground">
            Your order has been sent to the shop and is awaiting kitchen acceptance.
          </p>
        </div>

        {/* Human-readable Order Token Display */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pickup Order Token
          </span>
          <div className="text-3xl font-extrabold tracking-widest font-mono text-primary">
            #{order.orderNumber}
          </div>
          <div className="text-xs text-muted-foreground">
            Present this number to counter staff when your order is ready.
          </div>
        </div>

        {/* Mock Payment Simulation Notice */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-0.5 leading-relaxed">
            <strong className="block text-foreground font-semibold">
              Test Order &bull; Mock Payment Simulation
            </strong>
            <span>
              No real money was collected. Payment provider is simulated as{" "}
              <code className="font-mono text-[11px] font-bold">MOCK_TEST</code>. Instant shop pickup only.
            </span>
          </div>
        </div>

        {/* Order Details & Items Summary */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="font-semibold text-foreground">{order.shop.name}</span>
            <Badge variant="outline" className="text-[10px] font-mono">
              Status: {order.status}
            </Badge>
          </div>

          {order.shop.location && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5 text-primary shrink-0" />
              <span>{order.shop.location}</span>
            </div>
          )}

          <div className="space-y-1 pt-1">
            {order.items.map((item) => {
              const productName = item.productNameSnapshot || item.productName || "Item";
              const unitPrice = item.unitPriceSnapshot ?? item.unitPrice;
              return (
                <div key={item.id} className="flex justify-between text-muted-foreground">
                  <span>
                    {item.quantity}x {productName}
                  </span>
                  <span className="font-mono text-foreground">
                    {formatPriceINR(unitPrice!)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between border-t border-border/80 pt-2 text-sm font-bold text-foreground">
            <span>Total Amount</span>
            <span className="font-mono">{formatPriceINR(order.totalAmount)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-1/2">
            Return to Menu
          </Button>
          <Link href={`/order/${order.id}`} className="w-full sm:w-1/2">
            <Button className="w-full gap-1.5">
              <span>Track Live Status</span>
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
