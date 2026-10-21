import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrderTrackerView } from "@/components/smart-ordering/order-tracker-view";
import { ActiveOrderIndicator } from "@/components/smart-ordering/active-orders-context";
import { ArrowLeft, Utensils, Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Track Campus Order | COLLEGA.LOL",
  description: "Live tracking for smart campus food orders and instant counter pickup tokens.",
};

async function OrderTrackerContent({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return <OrderTrackerView orderId={id} />;
}

export default function OrderDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Header */}
      <header className="border-b border-border/80 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/order"
              className="inline-flex items-center justify-center rounded-lg border border-border size-8 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Return to Menu"
            >
              <ArrowLeft className="size-4" />
            </Link>

            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-foreground">
                COLLEGA<span className="text-primary font-mono text-xs opacity-70">.LOL</span>
              </span>
              <span className="text-muted-foreground text-sm hidden sm:inline">/</span>
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline-flex items-center gap-1.5">
                <Utensils className="size-3.5 text-primary" />
                Order Tracking
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/order/history"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            >
              <span>My Orders</span>
              <ActiveOrderIndicator />
            </Link>
            <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 text-xs font-medium text-primary">
              Apex North Campus
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-primary mb-3" />
              <p className="text-sm">Loading order tracking data...</p>
            </div>
          }
        >
          <OrderTrackerContent params={params} />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground mt-auto">
        COLLEGA.LOL &copy; 2026 &bull; Smart Ordering Live Tracker
      </footer>
    </div>
  );
}
