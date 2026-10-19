import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { StudentOrderingCatalog } from "@/components/smart-ordering/student-ordering-catalog";
import { ArrowLeft, Utensils, RefreshCw } from "lucide-react";

export const metadata: Metadata = {
  title: "Campus Food Ordering | COLLEGA.LOL",
  description:
    "Browse campus food menus, live category catalogs, and prices for instant counter pickup.",
};

export default function OrderPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Header */}
      <header className="border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/order/shops"
              className="inline-flex items-center justify-center rounded-lg border border-border size-8 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Return to Campus Shops"
            >
              <ArrowLeft className="size-4" />
            </Link>

            <div className="flex items-center gap-2">
              <Link href="/" className="text-lg font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity">
                COLLEGA<span className="text-primary font-mono text-xs opacity-70">.LOL</span>
              </Link>
              <span className="text-muted-foreground text-sm hidden sm:inline">/</span>
              <Link href="/order/shops" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:inline flex items-center gap-1.5">
                <Utensils className="size-3.5 text-primary" />
                Campus Shops
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/order/history"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              My Orders
            </Link>
            <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 text-xs font-medium text-primary">
              Apex North Campus
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
        <React.Suspense
          fallback={
            <div className="flex flex-col items-center justify-center p-12 space-y-3">
              <RefreshCw className="size-6 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading campus catalog...</p>
            </div>
          }
        >
          <StudentOrderingCatalog />
        </React.Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground mt-auto">
        COLLEGA.LOL &copy; 2026 &bull; Smart Ordering Stage 6A Foundation
      </footer>
    </div>
  );
}
