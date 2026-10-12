// Public business details shown on legal and support pages. Set these in the
// hosting environment; until then the pages fall back to safe defaults.
export function getSiteDetails() {
  return {
    operatorName: process.env.LEGAL_ENTITY_NAME?.trim() || "RepairLog",
    operatorCountry: process.env.LEGAL_COUNTRY?.trim() || null,
    supportEmail: process.env.SUPPORT_EMAIL?.trim() || null,
    lastUpdated: "October 10, 2026",
  };
}
