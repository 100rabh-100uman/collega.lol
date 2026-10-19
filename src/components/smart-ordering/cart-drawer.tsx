"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  formatPaiseToINR,
  calculateLineTotalPaise,
  calculateSubtotalPaise,
} from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Info,
  MessageSquare,
} from "lucide-react";

export interface CartItem {
  productId: string;
  name: string;
  expectedUnitPrice: string;
  quantity: number;
  specialInstructions?: string;
  preparationTimeMins?: number | null;
  isAvailable?: boolean;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shopName: string;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdateInstructions: (productId: string, instructions: string) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onValidateCheckout: () => Promise<void>;
  isValidating: boolean;
  validationError: string | null;
  isCheckoutReady: boolean;
  onSubmitOrder: () => Promise<void>;
  isSubmitting: boolean;
}

export function CartDrawer({
  isOpen,
  onClose,
  shopName,
  items,
  onUpdateQuantity,
  onUpdateInstructions,
  onRemoveItem,
  onClearCart,
  onValidateCheckout,
  isValidating,
  validationError,
  isCheckoutReady,
  onSubmitOrder,
  isSubmitting,
}: CartDrawerProps) {
  const [activeInstructionId, setActiveInstructionId] = React.useState<string | null>(null);

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Exact monetary subtotal in integer paise
  const subtotalPaise = calculateSubtotalPaise(items);
  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const hasUnavailableItems = items.some((i) => i.isAvailable === false);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <aside
          className="w-screen max-w-md border-l border-border bg-card shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Campus Shopping Cart"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <ShoppingBag className="size-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Your Order Cart
                </h2>
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                {shopName} &bull; {totalItemsCount} item{totalItemsCount === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {items.length > 0 && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={onClearCart}
                  className="text-xs text-muted-foreground hover:text-destructive"
                  title="Clear all items from cart"
                >
                  Clear
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Close cart"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Out of Stock Warning Banner */}
          {hasUnavailableItems && (
            <div className="m-4 mb-0 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2.5">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="font-semibold">Items in your cart are out of stock</div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  Some items are currently unavailable. Please remove them before you can proceed to checkout.
                </p>
              </div>
            </div>
          )}

          {/* Validation Error Banner */}
          {validationError && (
            <div className="m-4 mb-0 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2.5">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{validationError}</div>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-3">
                <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <ShoppingBag className="size-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Your cart is empty</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Browse the menu and add items to begin building your campus order.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={onClose} className="mt-2">
                  Browse Menu
                </Button>
              </div>
            ) : (
              items.map((item) => {
                const lineTotalPaise = calculateLineTotalPaise(item.quantity, item.expectedUnitPrice);
                const isInstructionOpen = activeInstructionId === item.productId || Boolean(item.specialInstructions);
                const isItemUnavailable = item.isAvailable === false;

                return (
                  <div
                    key={item.productId}
                    className={`rounded-xl border p-4 space-y-3 transition-colors ${
                      isItemUnavailable
                        ? "border-destructive/50 bg-destructive/5"
                        : "border-border bg-card/60 hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground truncate">
                            {item.name}
                          </span>
                          {isItemUnavailable && (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                              Out of Stock
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {formatPaiseToINR(calculateLineTotalPaise(1, item.expectedUnitPrice))} each
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold font-mono text-foreground">
                          {formatPaiseToINR(lineTotalPaise)}
                        </div>
                      </div>
                    </div>

                    {/* Quantity Stepper & Actions */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 border border-border rounded-lg bg-background p-0.5">
                        <button
                          onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-semibold font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                          disabled={item.quantity >= 50}
                          className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setActiveInstructionId(
                              activeInstructionId === item.productId ? null : item.productId
                            )
                          }
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                            item.specialInstructions
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                          title="Add instructions"
                        >
                          <MessageSquare className="size-3" />
                          <span>{item.specialInstructions ? "Note added" : "Note"}</span>
                        </button>

                        <button
                          onClick={() => onRemoveItem(item.productId)}
                          className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Remove item"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Special Instructions Field */}
                    {isInstructionOpen && (
                      <div className="pt-2 border-t border-border/50 animate-in fade-in">
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Special Instructions (Optional &bull; Max 250 chars)
                        </label>
                        <input
                          type="text"
                          value={item.specialInstructions || ""}
                          maxLength={250}
                          onChange={(e) => onUpdateInstructions(item.productId, e.target.value)}
                          placeholder="e.g. Extra napkins, no spicy chutney"
                          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer & Checkout Validation Summary */}
          {items.length > 0 && (
            <div className="border-t border-border bg-card p-5 space-y-4">
              {/* Order Cost Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Items Subtotal</span>
                  <span className="font-mono text-foreground">{formatPaiseToINR(subtotalPaise)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Counter Pickup Service</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                    FREE
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-foreground border-t border-border/80 pt-2">
                  <span>Authoritative Total</span>
                  <span className="font-mono text-base">{formatPaiseToINR(subtotalPaise)}</span>
                </div>
              </div>

              {/* Simulated Payment Notice */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
                <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <p className="leading-snug">
                  <strong>Simulated Campus Payment:</strong> No real money is charged. Test payment records are set to <code className="font-mono">MOCK_TEST</code> upon server order placement.
                </p>
              </div>

              {/* Readiness Outcome / Action */}
              {isCheckoutReady ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                      Cart Validated & Ready for Checkout
                    </div>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      Product availability and authoritative server prices are confirmed matching.
                    </p>
                  </div>

                  <Button
                    onClick={onSubmitOrder}
                    disabled={isSubmitting || items.length === 0 || hasUnavailableItems}
                    className="w-full gap-2 h-11 text-sm font-bold shadow-md"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="size-4 animate-spin" />
                        Submitting Order...
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="size-4" />
                        {hasUnavailableItems ? "Remove Out of Stock Items" : "Place Test Order (Mock Payment)"}
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={onValidateCheckout}
                  disabled={isValidating || items.length === 0 || hasUnavailableItems}
                  className="w-full gap-2 h-10 font-semibold"
                >
                  {isValidating ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Validating Catalog & Prices...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      {hasUnavailableItems ? "Resolve Out of Stock Items" : "Validate Order & Proceed"}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
