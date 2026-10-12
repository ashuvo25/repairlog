import { Fraunces } from "next/font/google";

// Display serif for the public site: a menu-board feel for headings only.
export const displayFont = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["SOFT", "opsz"],
});
