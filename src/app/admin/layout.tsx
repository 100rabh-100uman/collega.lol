import { Suspense } from "react";
import Link from "next/link";
import { getCurrentSession } from "@/core/auth/session";
import { prisma } from "@/core/db/prisma";
import { AdminNav } from "@/components/admin/admin-nav";
import { ShieldAlert, Lock, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Admin Console | COLLEGA.LOL",
  description: "Campus Shop Administration and Tenancy Control",
};

async function AdminSessionGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  // 1. Unauthenticated -> 401 Unauthorized State
  if (!session) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
          <Lock className="size-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Sign In Required
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
          You must be authenticated with an authorized administrator account to access the COLLEGA.LOL Admin Console.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="size-4" />
              Return Home
            </Button>
          </Link>
          <Link href="/shop">
            <Button size="sm">
              Go to Merchant Portal
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 2. Non-admin role -> 403 Forbidden State
  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "CAMPUS_ADMIN") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
          <ShieldAlert className="size-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Administrative Privileges Required
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
          Your current account (<span className="font-mono font-medium text-foreground">{session.user.email}</span>) has role{" "}
          <span className="font-semibold text-foreground uppercase">{role}</span>. Access to the Admin Console is strictly restricted to Campus Administrators and Super Administrators.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link href="/order/shops">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="size-4" />
              Campus Dining
            </Button>
          </Link>
          <Link href="/shop">
            <Button size="sm">
              Merchant Portal
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Resolve campus name for the navbar if user belongs to a campus
  let campusName = "All Campuses (Super Admin)";
  if (session.user.campusId) {
    try {
      const campus = await prisma.campus.findUnique({
        where: { id: session.user.campusId },
        select: { name: true },
      });
      if (campus) {
        campusName = campus.name;
      }
    } catch {
      // Fallback
      campusName = "Campus Admin";
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminNav
        userRole={role}
        campusName={campusName}
      />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <RefreshCw className="size-8 text-primary animate-spin mb-3" />
          <p className="text-sm font-medium text-foreground">Verifying administrative credentials...</p>
        </div>
      }
    >
      <AdminSessionGuard>{children}</AdminSessionGuard>
    </Suspense>
  );
}

