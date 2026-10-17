import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Returns the effective Supabase publishable key, prioritizing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * with fallback to legacy NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function getSupabasePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Returns the effective Supabase secret key, prioritizing SUPABASE_SECRET_KEY
 * with fallback to legacy SUPABASE_SERVICE_ROLE_KEY.
 */
export function getSupabaseSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Safely parses and validates environment variables.
 * Never logs or exposes secret values.
 */
export function getEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missingKeys = result.error.issues.map((e) => e.path.join("."));
    throw new Error(
      `Missing or invalid required environment variable(s): ${missingKeys.join(", ")}`
    );
  }

  const publishableKey = getSupabasePublishableKey();
  if (!publishableKey) {
    throw new Error(
      "Missing Supabase publishable key: specify NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }

  return result.data;
}

export interface ConfigReadiness {
  isConfigured: boolean;
  isPlaceholder: boolean;
  message: string;
}

/**
 * Checks whether PostgreSQL database connection string is real or placeholder.
 * Never prints or leaks credentials.
 */
export function checkDatabaseReadiness(): ConfigReadiness {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return {
      isConfigured: false,
      isPlaceholder: false,
      message: "DATABASE_URL is not set.",
    };
  }

  const isPlaceholder =
    url.includes("[project-ref]") ||
    url.includes("[your-db-password]") ||
    url.includes("localhost:5432/collega_dev") ||
    url.includes("placeholder") ||
    url.includes("postgres:postgres@localhost");

  return {
    isConfigured: true,
    isPlaceholder,
    message: isPlaceholder
      ? "DATABASE_URL contains placeholder values. Live PostgreSQL target is not yet connected."
      : "DATABASE_URL is configured with non-placeholder format.",
  };
}

/**
 * Checks whether Supabase project URL and keys are real or placeholders.
 * Never prints or leaks credentials.
 */
export function checkSupabaseReadiness(): ConfigReadiness {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) {
    return {
      isConfigured: false,
      isPlaceholder: false,
      message: "Supabase URL or Publishable Key is missing.",
    };
  }

  const isPlaceholder =
    url.includes("[project-ref]") ||
    url.includes("placeholder-project") ||
    url.includes("your-project-id") ||
    publishableKey.includes("placeholder") ||
    publishableKey.includes("your-publishable-key");

  return {
    isConfigured: true,
    isPlaceholder,
    message: isPlaceholder
      ? "Supabase URL / Publishable Key contains default placeholders. Live Supabase project is not yet connected."
      : "Supabase credentials are configured with non-placeholder format.",
  };
}
