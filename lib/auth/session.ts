import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server/client";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const subject = claims?.sub;

  if (error || typeof subject !== "string") {
    return null;
  }

  return {
    id: subject,
    email: typeof claims?.email === "string" ? claims.email : null,
  };
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}
