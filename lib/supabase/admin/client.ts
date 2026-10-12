import { createClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/supabase/config";

// Bypasses row-level security. Use only in billing webhooks and scheduled
// jobs, never in code that handles a signed-in user's own request data.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing required environment variable: SUPABASE_SECRET_KEY");
  }

  return createClient(getSupabaseConfig().url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
