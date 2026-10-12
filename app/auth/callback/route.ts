import { NextResponse } from "next/server";

import { getAppUrl, getSafeNextPath } from "@/lib/auth/app-url";
import { createClient } from "@/lib/supabase/server/client";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const response = NextResponse.redirect(new URL(nextPath, getAppUrl()));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }

  const errorUrl = new URL("/sign-in", getAppUrl());
  errorUrl.searchParams.set("error", "oauth_callback_failed");
  return NextResponse.redirect(errorUrl);
}
