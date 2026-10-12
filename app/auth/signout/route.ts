import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAppUrl } from "@/lib/auth/app-url";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { createClient } from "@/lib/supabase/server/client";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  const response = NextResponse.redirect(new URL("/sign-in", getAppUrl()), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
