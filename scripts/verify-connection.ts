/**
 * COLLEGA.LOL — Safe Connection Verification Script
 * Tests local .env configuration, Prisma PostgreSQL connectivity, and Supabase reachability
 * WITHOUT ever printing passwords, tokens, or secret keys to the console.
 */

// Ensure local .env is loaded if script is executed directly without CLI flags
try {
  process.loadEnvFile?.(".env");
} catch {
  // If .env is already loaded or absent, proceed gracefully
}

import { checkDatabaseReadiness, checkSupabaseReadiness } from "../src/core/config/env";
import { prisma } from "../src/core/db/prisma";
import { createBrowserSupabaseClient } from "../src/core/supabase/client";

async function main() {
  console.log("\n========================================================");
  console.log("  COLLEGA.LOL — Connection & Environment Verification  ");
  console.log("========================================================\n");

  const dbStatus = checkDatabaseReadiness();
  const supabaseStatus = checkSupabaseReadiness();

  console.log(`[Config Check] PostgreSQL: ${dbStatus.message}`);
  console.log(`[Config Check] Supabase:   ${supabaseStatus.message}\n`);

  if (dbStatus.isPlaceholder || !dbStatus.isConfigured) {
    console.log("⚠️  PostgreSQL is using placeholder credentials.");
    console.log("    To connect to your live database, update DATABASE_URL and DIRECT_URL in .env.\n");
  } else {
    console.log("🔌 Testing PostgreSQL database connection via Prisma...");
    try {
      await prisma.$queryRaw`SELECT 1 as connected;`;
      console.log("✅ PostgreSQL connection SUCCESSFUL! Database is reachable and responding.\n");
    } catch (err: unknown) {
      const error = err as Error;
      console.log("❌ PostgreSQL connection FAILED.");
      console.log(`   Reason: ${error.message.split("\n")[0]}`);
      console.log("   (Verify your database password and network connection in .env)\n");
    } finally {
      await prisma.$disconnect();
    }
  }

  if (supabaseStatus.isPlaceholder || !supabaseStatus.isConfigured) {
    console.log("⚠️  Supabase is using placeholder credentials.");
    console.log("    To connect, update NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.\n");
  } else {
    console.log("🔌 Testing Supabase API reachability...");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.getSession();
      if (error) {
        console.log(`⚠️  Supabase responded with an auth note: ${error.message}\n`);
      } else {
        console.log("✅ Supabase API reachability SUCCESSFUL!\n");
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.log("❌ Supabase connection FAILED.");
      console.log(`   Reason: ${error.message.split("\n")[0]}\n`);
    }
  }

  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("Verification script encountered an unexpected error:", err);
  process.exit(1);
});
