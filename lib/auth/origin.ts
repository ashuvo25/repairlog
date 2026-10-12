import { getAppUrl } from "@/lib/auth/app-url";

export function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === getAppUrl().origin;
  } catch {
    return false;
  }
}
