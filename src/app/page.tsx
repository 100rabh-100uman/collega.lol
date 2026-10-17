import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navigation Shell */}
      <header className="border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-foreground">
              COLLEGA<span className="text-primary font-mono text-sm opacity-70">.LOL</span>
            </span>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Phase 4 Foundation
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              Architecture Docs
            </Button>
            <Button size="sm">
              System Ready
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container Shell */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
            Modular Monolith Foundation Active
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
            Connected Campus Platform
          </h1>
          <p className="text-lg text-muted-foreground">
            The Next.js App Router, TypeScript, and shadcn/ui application foundation is cleanly initialized. Module boundaries and shared Core are active.
          </p>
        </div>

        {/* Modules Status Grid */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-primary/20 bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-card-foreground">1. Smart Ordering</h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Next Stage: MVP
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Food kiosk ordering, manual vendor acceptance, 3/5-min timers, and counter pickup tokens.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-6 opacity-75">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-card-foreground">2. Parcel Assistance</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Planned
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Peer-to-peer campus gate and courier delivery assistance.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-6 opacity-75">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-card-foreground">3. Buy/Sell</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Planned
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Campus marketplace for books, stationery, and dorm essentials.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-6 opacity-75">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-card-foreground">4. Student Earning</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Planned
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Unified framework for campus student tasks and peer gigs.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        COLLEGA.LOL &copy; 2026 &bull; Strict Architecture & Security Enforced
      </footer>
    </div>
  );
}
