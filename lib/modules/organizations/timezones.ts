export const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)", example: "New York, Miami" },
  { value: "America/Chicago", label: "Central Time (CT)", example: "Chicago, Dallas" },
  { value: "America/Denver", label: "Mountain Time (MT)", example: "Denver, Salt Lake City" },
  { value: "America/Phoenix", label: "Arizona (MST, no daylight saving)", example: "Phoenix" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)", example: "Los Angeles, Seattle" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)", example: "Anchorage" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)", example: "Honolulu" },
] as const;

export const DEFAULT_TIMEZONE = "America/New_York";

export function isUsTimezone(value: string | null | undefined) {
  return US_TIMEZONES.some((zone) => zone.value === value);
}

export function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
