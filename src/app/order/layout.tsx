import * as React from "react";
import { ActiveOrdersProvider } from "@/components/smart-ordering/active-orders-context";

export default function OrderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ActiveOrdersProvider>{children}</ActiveOrdersProvider>;
}
