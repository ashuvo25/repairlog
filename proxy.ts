import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/sign-in",
    "/invitation/:path*",
    "/auth/:path*",
    "/onboarding/:path*",
    "/today/:path*",
    "/equipment/:path*",
    "/reports/:path*",
    "/report/:path*",
    "/tickets/:path*",
    "/menu-impact/:path*",
    "/settings/:path*",
    "/api/exports/:path*",
    "/api/tickets/:path*",
  ],
};
