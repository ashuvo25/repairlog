export function getAppUrl() {
  const configuredUrl = process.env.APP_URL;

  if (!configuredUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_URL is required in production.");
    }

    return new URL("http://localhost:3000");
  }

  const appUrl = new URL(configuredUrl);

  if (
    appUrl.protocol !== "https:" &&
    !(appUrl.protocol === "http:" && appUrl.hostname === "localhost")
  ) {
    throw new Error("APP_URL must use HTTPS, except on localhost.");
  }

  return appUrl;
}

export function getSafeNextPath(value: string | null, fallback = "/today") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}
