import * as React from "react";
import type { Metadata } from "next";
import { MobileStaffView } from "@/components/shop-portal/mobile-staff-view";
import { RefreshCw } from "lucide-react";

export const metadata: Metadata = {
  title: "Counter Staff Portal | COLLEGA.LOL",
  description: "Secure mobile counter terminal for campus food shop order fulfillment.",
};

function StaffLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-3">
        <RefreshCw className="size-8 animate-spin mx-auto text-primary" />
        <p className="text-sm font-medium text-muted-foreground">
          Loading Counter Terminal...
        </p>
      </div>
    </div>
  );
}

export default function StaffPage() {
  return (
    <React.Suspense fallback={<StaffLoadingFallback />}>
      <MobileStaffView />
    </React.Suspense>
  );
}
