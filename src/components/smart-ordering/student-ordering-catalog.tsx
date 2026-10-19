"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CartDrawer, type CartItem } from "./cart-drawer";
import { PriceMismatchModal, type MismatchItem } from "./price-mismatch-modal";
import { OrderConfirmationModal, type ConfirmedOrderData } from "./order-confirmation-modal";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  formatPriceINR,
  formatPaiseToINR,
  parsePriceToPaise,
  calculateSubtotalPaise,
} from "@/lib/currency";
import {
  Store,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  UtensilsCrossed,
  ShieldAlert,
  Sparkles,
  ShoppingBag,
  Plus,
  Minus,
  Info,
} from "lucide-react";

export interface Shop {
  id: string;
  campusId: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  isOpen: boolean;
  autoAcceptOrders: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  preparationTimeMins: number | null;
  imageUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  isAvailable: boolean;
  products: Product[];
}

export interface ShopMenuResponse {
  shop: Shop;
  categories: Category[];
}

export function StudentOrderingCatalog() {
  const searchParams = useSearchParams();
  const queryShopId = searchParams?.get("shopId");

  const [shops, setShops] = React.useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = React.useState<string | null>(null);
  const [menu, setMenu] = React.useState<ShopMenuResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [cartShopId, setCartShopId] = React.useState<string | null>(null);
  const [shopSelectionNotice, setShopSelectionNotice] = React.useState<string | null>(null);

  const [loadingShops, setLoadingShops] = React.useState<boolean>(true);
  const [loadingMenu, setLoadingMenu] = React.useState<boolean>(false);
  const [authError, setAuthError] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isDevAuthenticating, setIsDevAuthenticating] = React.useState<boolean>(false);
  const [refreshKey, setRefreshKey] = React.useState<number>(0);

  // Cart & Stage 6B State
  const [cartItems, setCartItems] = React.useState<CartItem[]>([]);
  const [imageErrors, setImageErrors] = React.useState<Record<string, boolean>>({});
  const [isCartOpen, setIsCartOpen] = React.useState<boolean>(false);
  const [isValidatingCheckout, setIsValidatingCheckout] = React.useState<boolean>(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [isCheckoutReady, setIsCheckoutReady] = React.useState<boolean>(false);
  const [mismatches, setMismatches] = React.useState<MismatchItem[]>([]);
  const [isMismatchModalOpen, setIsMismatchModalOpen] = React.useState<boolean>(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = React.useState<boolean>(false);
  const [confirmedOrder, setConfirmedOrder] = React.useState<ConfirmedOrderData | null>(null);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = React.useState<boolean>(false);

  const triggerRefresh = React.useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // 1. Fetch campus shops
  React.useEffect(() => {
    let ignore = false;

    async function loadShops() {
      try {
        const res = await fetch("/api/shops", {
          headers: { "Content-Type": "application/json" },
        });

        if (ignore) return;

        if (res.status === 401) {
          setAuthError(true);
          setLoadingShops(false);
          return;
        }

        const json = await res.json();
        if (ignore) return;

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || "Failed to load campus shops");
        }

        const loadedShops: Shop[] = json.data || [];
        setShops(loadedShops);

        if (loadedShops.length > 0) {
          if (queryShopId) {
            const matchedShop = loadedShops.find((s) => s.id === queryShopId);
            if (matchedShop) {
              setSelectedShopId(matchedShop.id);
              setShopSelectionNotice(null);
            } else {
              setSelectedShopId(loadedShops[0].id);
              setShopSelectionNotice(
                "The requested shop was not found on your campus. Showing the primary campus shop."
              );
            }
          } else {
            setSelectedShopId((current) => current || loadedShops[0].id);
            setShopSelectionNotice(null);
          }
        }
      } catch (err) {
        if (!ignore) {
          setErrorMessage(err instanceof Error ? err.message : "Error connecting to service");
        }
      } finally {
        if (!ignore) {
          setLoadingShops(false);
        }
      }
    }

    loadShops();

    return () => {
      ignore = true;
    };
  }, [refreshKey, queryShopId]);


  // 2. Fetch menu when selected shop changes
  React.useEffect(() => {
    if (!selectedShopId) return;

    let ignore = false;

    async function loadMenu(shopId: string) {
      try {
        const res = await fetch(`/api/shops/${shopId}/menu`, {
          headers: { "Content-Type": "application/json" },
        });

        if (ignore) return;

        if (res.status === 401) {
          setAuthError(true);
          setLoadingMenu(false);
          return;
        }

        const json = await res.json();
        if (ignore) return;

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || "Failed to load shop menu");
        }

        setMenu(json.data);
        setSelectedCategory("all");
      } catch (err) {
        if (!ignore) {
          setErrorMessage(err instanceof Error ? err.message : "Error loading menu");
        }
      } finally {
        if (!ignore) {
          setLoadingMenu(false);
        }
      }
    }

    loadMenu(selectedShopId);

    return () => {
      ignore = true;
    };
  }, [selectedShopId, refreshKey]);

  // Dev Session Connect Handler (Non-production local development)
  const handleConnectDevSession = async () => {
    setIsDevAuthenticating(true);
    try {
      const res = await fetch("/api/dev/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setAuthError(false);
        setLoadingShops(true);
        triggerRefresh();
      } else {
        setErrorMessage(json.error?.message || "Could not establish dev session");
      }
    } catch {
      setErrorMessage("Network error while connecting dev session");
    } finally {
      setIsDevAuthenticating(false);
    }
  };

  // 3. Computed items based on category selection
  const allProducts = React.useMemo(() => {
    if (!menu?.categories) return [];
    return menu.categories.flatMap((cat) =>
      cat.products.map((p) => ({ ...p, categoryName: cat.name, categoryId: cat.id }))
    );
  }, [menu]);

  const filteredProducts = React.useMemo(() => {
    if (selectedCategory === "all") return allProducts;
    return allProducts.filter((p) => p.categoryId === selectedCategory);
  }, [allProducts, selectedCategory]);

  const selectedShop = React.useMemo(() => {
    return shops.find((s) => s.id === selectedShopId) || menu?.shop;
  }, [shops, selectedShopId, menu]);

  // Computed cart items with authoritative availability from latest catalog
  const cartItemsWithAvailability = React.useMemo(() => {
    const productMap = new Map<string, Product>();
    menu?.categories.forEach((cat) => {
      cat.products.forEach((p) => productMap.set(p.id, p));
    });
    return cartItems.map((item) => {
      const prod = productMap.get(item.productId);
      const isAvailable = prod !== undefined ? prod.isAvailable : true;
      return {
        ...item,
        isAvailable,
      };
    });
  }, [cartItems, menu]);

  // Cart operations
  const handleAddToCart = (product: Product) => {
    if (!product.isAvailable) return;

    // Cart shop scoping guard: prevent mixing products from different shops
    if (cartItems.length > 0 && cartShopId && cartShopId !== selectedShopId) {
      const targetShopName = selectedShop?.name || "this shop";
      if (
        confirm(
          `Your cart contains items from another shop. Would you like to clear your cart and start a new order with ${targetShopName}?`
        )
      ) {
        setCartItems([
          {
            productId: product.id,
            name: product.name,
            expectedUnitPrice: String(product.price),
            quantity: 1,
            preparationTimeMins: product.preparationTimeMins,
          },
        ]);
        setCartShopId(selectedShopId);
        setIsCheckoutReady(false);
        setValidationError(null);
      }
      return;
    }

    setIsCheckoutReady(false);
    setValidationError(null);
    setCartShopId(selectedShopId);

    setCartItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: Math.min(50, i.quantity + 1) } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          expectedUnitPrice: String(product.price),
          quantity: 1,
          preparationTimeMins: product.preparationTimeMins,
        },
      ];
    });
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setIsCheckoutReady(false);
    setValidationError(null);
    setCartItems((prev) => {
      const next = prev
        .map((i) => (i.productId === productId ? { ...i, quantity: Math.min(50, Math.max(1, quantity)) } : i))
        .filter((i) => i.quantity > 0);
      if (next.length === 0) {
        setCartShopId(null);
      }
      return next;
    });
  };

  const handleUpdateInstructions = (productId: string, instructions: string) => {
    setCartItems((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, specialInstructions: instructions.slice(0, 250) } : i
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setIsCheckoutReady(false);
    setValidationError(null);
    setCartItems((prev) => {
      const next = prev.filter((i) => i.productId !== productId);
      if (next.length === 0) {
        setCartShopId(null);
      }
      return next;
    });
  };

  const handleClearCart = () => {
    setCartItems([]);
    setCartShopId(null);
    setIsCheckoutReady(false);
    setValidationError(null);
  };

  // Revalidation and Pre-checkout Check
  const handleValidateCheckout = async () => {
    if (!selectedShopId || cartItems.length === 0) return;

    if (cartShopId && selectedShopId && cartShopId !== selectedShopId) {
      setValidationError("Cart items do not belong to the selected shop. Please clear cart before checking out.");
      return;
    }

    setIsValidatingCheckout(true);
    setValidationError(null);
    setIsCheckoutReady(false);

    try {
      // Re-fetch fresh menu from server
      const res = await fetch(`/api/shops/${selectedShopId}/menu`, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 401) {
        setAuthError(true);
        setValidationError("Session expired. Please re-authenticate.");
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Server verification failed");
      }

      const freshMenu: ShopMenuResponse = json.data;

      // 1. Verify shop status
      if (!freshMenu.shop.isOpen) {
        setValidationError("This shop has closed and is not accepting orders at this time.");
        return;
      }

      // Map fresh products
      const freshMap = new Map<string, Product>();
      freshMenu.categories.forEach((cat) => {
        cat.products.forEach((p) => freshMap.set(p.id, p));
      });

      // 2. Verify availability and detect price mismatches
      const detectedMismatches: MismatchItem[] = [];
      for (const item of cartItems) {
        const freshProduct = freshMap.get(item.productId);
        if (!freshProduct || !freshProduct.isAvailable) {
          setValidationError(`"${item.name}" is no longer available. Please remove it from your cart.`);
          return;
        }

        const expPaise = parsePriceToPaise(item.expectedUnitPrice);
        const actPaise = parsePriceToPaise(freshProduct.price);

        if (expPaise !== actPaise) {
          detectedMismatches.push({
            productId: item.productId,
            productName: item.name,
            expectedPrice: item.expectedUnitPrice,
            actualPrice: String(freshProduct.price),
          });
        }
      }

      // 3. Handle detected price mismatches
      if (detectedMismatches.length > 0) {
        setMismatches(detectedMismatches);
        setIsMismatchModalOpen(true);
        setValidationError(
          "Price changes detected on the server. Please confirm updated prices to proceed."
        );
        return;
      }

      // 4. All checks passed
      setIsCheckoutReady(true);
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : "Network error during checkout verification"
      );
    } finally {
      setIsValidatingCheckout(false);
    }
  };

  // Explicit user confirmation of price changes (HTTP 409 recovery)
  const handleAcceptPriceMismatches = (acceptedMismatches: MismatchItem[]) => {
    const mismatchMap = new Map<string, string>();
    acceptedMismatches.forEach((m) => mismatchMap.set(m.productId, m.actualPrice));

    // Update expected prices in cart
    setCartItems((prev) =>
      prev.map((item) => {
        const newPrice = mismatchMap.get(item.productId);
        return newPrice ? { ...item, expectedUnitPrice: newPrice } : item;
      })
    );

    setIsMismatchModalOpen(false);
    setMismatches([]);
    setValidationError(null);

    // Trigger fresh revalidation with updated prices
    setTimeout(() => {
      handleValidateCheckout();
    }, 100);
  };

  // Submit the validated cart to POST /api/orders (Stage 6C)
  const handleSubmitOrder = async () => {
    if (!selectedShopId || cartItems.length === 0 || isSubmittingOrder) return;

    if (cartShopId && selectedShopId && cartShopId !== selectedShopId) {
      setValidationError("Cart items do not belong to the selected shop. Please clear cart before checking out.");
      return;
    }

    setIsSubmittingOrder(true);
    setValidationError(null);

    // Client idempotency key preventing duplicate submissions
    const idempotencyKey = `order_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    try {
      const payload = {
        shopId: selectedShopId,
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          expectedUnitPrice: item.expectedUnitPrice,
          specialInstructions: item.specialInstructions || undefined,
        })),
        idempotencyKey,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (res.status === 409) {
        if (json?.error?.code === "PRICE_MISMATCH" && Array.isArray(json.error.mismatches)) {
          setMismatches(json.error.mismatches);
          setIsMismatchModalOpen(true);
          setIsCheckoutReady(false);
          setValidationError(
            "Authoritative server price mismatch detected. Please review updated prices."
          );
          return;
        }
        if (json?.error?.code === "SHOP_CLOSED") {
          setIsCheckoutReady(false);
          setValidationError("This shop has closed and is not accepting orders at this time.");
          return;
        }
        if (json?.error?.code === "PRODUCT_UNAVAILABLE") {
          setIsCheckoutReady(false);
          setValidationError(json.error.message || "An item in your cart is no longer available.");
          return;
        }
      }

      if (!res.ok || !json?.success) {
        setIsCheckoutReady(false);
        throw new Error(json?.error?.message || "Failed to place order");
      }

      // Success: 201 Created
      setConfirmedOrder(json.data);
      setIsConfirmationModalOpen(true);
      setCartItems([]);
      setIsCartOpen(false);
      setIsCheckoutReady(false);
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : "Network error during order submission"
      );
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Total cart summary calculations
  const totalCartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);
  const cartSubtotalPaise = calculateSubtotalPaise(cartItems);

  // --- STATE 1: Authentication Required ---
  if (authError) {
    return (
      <Card className="max-w-xl mx-auto my-12 border-dashed">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <ShieldAlert className="size-6" />
          </div>
          <CardTitle className="text-xl">Authentication Required</CardTitle>
          <CardDescription>
            You must be signed in with your campus student identity to access shop menus and place orders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-2">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-4 text-amber-500" />
              Development Environment Detected
            </div>
            <p>
              In local development, you can connect an isolated test student identity for{" "}
              <strong>Apex Institute of Technology — North Campus</strong> with one click.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              onClick={handleConnectDevSession}
              disabled={isDevAuthenticating}
              className="w-full sm:w-auto"
            >
              {isDevAuthenticating ? (
                <>
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect as Student (Apex North)"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={triggerRefresh}
              className="w-full sm:w-auto"
            >
              Retry Connection
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- STATE 2: Loading Shops ---
  if (loadingShops) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto py-8">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
        <div className="h-32 bg-muted/60 animate-pulse rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 bg-muted/40 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // --- STATE 3: Error Encountered ---
  if (errorMessage && !menu) {
    return (
      <Card className="max-w-xl mx-auto my-12 border-destructive/30">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
            <AlertCircle className="size-6" />
          </div>
          <CardTitle className="text-lg">Unable to Load Catalog</CardTitle>
          <CardDescription className="text-destructive font-medium">
            {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pt-4">
          <Button variant="outline" onClick={triggerRefresh}>
            <RefreshCw className="mr-2 size-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // --- STATE 4: Empty Campus Shops ---
  if (shops.length === 0) {
    return (
      <Card className="max-w-xl mx-auto my-12 text-center">
        <CardHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
            <Store className="size-6" />
          </div>
          <CardTitle>No Active Shops Found</CardTitle>
          <CardDescription>
            There are currently no active food shops registered in your campus area.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={triggerRefresh}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      {/* Notice when query param shop was invalid or unavailable */}
      {shopSelectionNotice && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info className="size-4 shrink-0" />
            <span>{shopSelectionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setShopSelectionNotice(null)}
            className="text-xs font-semibold hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}



      {/* 2. Shop Header & Status Banner */}
      {selectedShop && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {selectedShop.name}
                </h1>
                {selectedShop.isOpen ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="size-3.5" />
                    Open for Orders
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="size-3.5" />
                    Currently Closed
                  </Badge>
                )}
              </div>

              {selectedShop.description && (
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {selectedShop.description}
                </p>
              )}

              {selectedShop.location && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                  <MapPin className="size-3.5 shrink-0 text-primary" />
                  <span>{selectedShop.location}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
              {/* Header Cart Button */}
              {totalCartCount > 0 && (
                <Button
                  onClick={() => setIsCartOpen(true)}
                  className="gap-2 shadow-xs animate-in zoom-in-95 duration-150"
                  size="sm"
                >
                  <ShoppingBag className="size-4" />
                  <span>Cart ({totalCartCount})</span>
                  <span className="font-mono text-xs opacity-90">
                    &bull; {formatPaiseToINR(cartSubtotalPaise)}
                  </span>
                </Button>
              )}

              <Link href="/order/history">
                <Button variant="outline" size="sm" className="text-xs">
                  My Orders
                </Button>
              </Link>

              <Button
                variant="outline"
                size="sm"
                onClick={triggerRefresh}
                disabled={loadingMenu}
                title="Refresh Menu"
              >
                <RefreshCw className={`size-3.5 ${loadingMenu ? "animate-spin" : ""}`} />
                <span className="ml-1.5 hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {!selectedShop.isOpen && (
            <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>
                This shop is currently closed. You can view the menu, but new orders are paused until opening.
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3. Category Filter Tabs */}
      {menu && menu.categories.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <UtensilsCrossed className="size-4 text-primary" />
              Menu & Categories
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              {filteredProducts.length} item{filteredProducts.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-border pb-3">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
                selectedCategory === "all"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              All Items ({allProducts.length})
            </button>
            {menu.categories.map((cat) => {
              const count = cat.products.length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Product Catalog Grid */}
      {loadingMenu ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 bg-muted/40 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <UtensilsCrossed className="mx-auto size-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">No products available in this category</p>
          <p className="text-xs text-muted-foreground mt-1">Please select another category or check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((product) => {
            const cartEntry = cartItems.find((i) => i.productId === product.id);
            const inCartCount = cartEntry ? cartEntry.quantity : 0;
            const hasImage = Boolean(product.imageUrl) && !imageErrors[product.id];

            return (
              <Card
                key={product.id}
                className={`overflow-hidden transition-all hover:border-primary/40 flex flex-col justify-between ${
                  !product.isAvailable ? "opacity-75 bg-muted/20" : ""
                }`}
              >
                <div className="flex flex-col sm:flex-row h-full">
                  {/* Product Image / Clean Placeholder */}
                  <div className="relative w-full sm:w-44 h-44 sm:h-auto shrink-0 bg-muted/30 overflow-hidden flex items-center justify-center border-b sm:border-b-0 sm:border-r border-border/60">
                    {hasImage ? (
                      <img
                        src={product.imageUrl!}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        onError={() =>
                          setImageErrors((prev) => ({ ...prev, [product.id]: true }))
                        }
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 text-center text-muted-foreground/60 select-none">
                        <div className="p-3 rounded-2xl bg-muted/50 mb-1.5">
                          <UtensilsCrossed className="size-8 text-muted-foreground/40" />
                        </div>
                        <span className="text-[11px] font-medium tracking-tight text-muted-foreground/50">
                          {product.categoryName || "Campus Food"}
                        </span>
                      </div>
                    )}

                    {/* Floating Out of Stock Badge on Image */}
                    {!product.isAvailable && (
                      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center p-2">
                        <Badge variant="destructive" className="font-bold text-xs uppercase tracking-wider shadow-sm">
                          Out of Stock
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Product Info & Action Area */}
                  <div className="flex-1 p-5 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-foreground leading-snug">
                            {product.name}
                          </h3>
                          <Badge variant="outline" className="text-[10px] font-normal py-0">
                            {product.categoryName}
                          </Badge>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-base font-bold text-foreground font-mono">
                            {formatPriceINR(product.price)}
                          </div>
                        </div>
                      </div>

                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3 pt-2 border-t border-border/60 mt-auto">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          {product.preparationTimeMins ? (
                            <>
                              <Clock className="size-3.5 text-muted-foreground" />
                              <span>Prep: {product.preparationTimeMins} mins</span>
                            </>
                          ) : (
                            <span>Instant counter pickup</span>
                          )}
                        </div>

                        <div>
                          {product.isAvailable ? (
                            <Badge variant="success" className="text-[10px] px-2 py-0">
                              In Stock
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] px-2 py-0">
                              Out of Stock
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Add to Cart / Quantity Stepper Controls */}
                      <div className="pt-1">
                        {!product.isAvailable || !selectedShop?.isOpen ? (
                          <Button size="sm" variant="outline" disabled className="w-full text-xs font-semibold">
                            {!selectedShop?.isOpen ? "Shop Closed" : "Currently Out of Stock"}
                          </Button>
                        ) : inCartCount === 0 ? (
                          <Button
                            size="sm"
                            onClick={() => handleAddToCart(product)}
                            className="w-full gap-1.5 text-xs font-semibold"
                          >
                            <Plus className="size-3.5" />
                            Add to Order Cart
                          </Button>
                        ) : (
                          <div className="flex items-center justify-between gap-2 bg-muted/40 border border-border rounded-lg p-1">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleUpdateQuantity(product.id, inCartCount - 1)}
                                className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="size-3" />
                              </button>
                              <span className="w-8 text-center text-xs font-bold font-mono">
                                {inCartCount}
                              </span>
                              <button
                                onClick={() => handleUpdateQuantity(product.id, inCartCount + 1)}
                                disabled={inCartCount >= 50}
                                className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
                                aria-label="Increase quantity"
                              >
                                <Plus className="size-3" />
                              </button>
                            </div>

                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => setIsCartOpen(true)}
                              className="text-xs text-primary font-medium"
                            >
                              View Cart &rarr;
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Cart Bar (Mobile & Desktop) */}
      {totalCartCount > 0 && (
        <aside
          aria-label="Cart Overview Bar"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-lg rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-md p-3.5 shadow-xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
              {totalCartCount}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Subtotal</div>
              <div className="text-base font-bold font-mono text-foreground">
                {formatPaiseToINR(cartSubtotalPaise)}
              </div>
            </div>
          </div>

          <Button onClick={() => setIsCartOpen(true)} className="gap-2 font-semibold">
            <ShoppingBag className="size-4" />
            Review Order
          </Button>
        </aside>
      )}

      {/* Responsive Cart Drawer / Sheet */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        shopName={selectedShop?.name || "Campus Shop"}
        items={cartItemsWithAvailability}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdateInstructions={handleUpdateInstructions}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onValidateCheckout={handleValidateCheckout}
        isValidating={isValidatingCheckout}
        validationError={validationError}
        isCheckoutReady={isCheckoutReady}
        onSubmitOrder={handleSubmitOrder}
        isSubmitting={isSubmittingOrder}
      />

      {/* Price Mismatch Reconfirmation Modal */}
      <PriceMismatchModal
        isOpen={isMismatchModalOpen}
        mismatches={mismatches}
        onAccept={handleAcceptPriceMismatches}
        onCancel={() => {
          setIsMismatchModalOpen(false);
          setMismatches([]);
        }}
      />

      {/* Order Confirmation Modal (Stage 6C) */}
      <OrderConfirmationModal
        isOpen={isConfirmationModalOpen}
        order={confirmedOrder}
        onClose={() => setIsConfirmationModalOpen(false)}
      />
    </div>
  );
}
