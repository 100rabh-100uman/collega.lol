import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey } from "../config/env";

/**
 * Creates a browser-side Supabase client using public publishable credentials.
 * Safe to use in Client Components ('use client').
 */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not configured."
    );
  }

  return createBrowserClient(url, publishableKey);
}
