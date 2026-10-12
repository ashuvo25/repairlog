"use server";

import { redirect } from "next/navigation";

import { getAppUrl, getSafeNextPath } from "@/lib/auth/app-url";
import { createClient } from "@/lib/supabase/server/client";

export async function signInWithGoogle(formData: FormData) {
  const nextPath = getSafeNextPath(formData.get("next")?.toString() ?? null);
  const callbackUrl = new URL("/auth/callback", getAppUrl());
  callbackUrl.searchParams.set("next", nextPath);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error || !data.url) {
    redirect("/sign-in?error=oauth_start_failed");
  }

  redirect(data.url);
}
