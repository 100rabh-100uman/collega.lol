import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey } from "../config/env";

/**
 * Creates an administrative Supabase client using SUPABASE_SECRET_KEY.
 * STRICTLY SERVER-SIDE ONLY. Never import or use in client-side code.
 */
export function createAdminSupabaseClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "SECURITY VIOLATION: createAdminSupabaseClient cannot be invoked on the client."
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = getSupabaseSecretKey();

  if (!url || !secretKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY is not configured."
    );
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
