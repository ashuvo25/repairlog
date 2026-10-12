import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const SOCIAL_IMAGE =
  "https://res.cloudinary.com/dnbdcic4r/video/upload/so_4,w_1200,h_630,c_fill,q_auto,f_jpg/v1791370713/RepairLog.jpg";

function siteUrl() {
  try {
    return new URL(process.env.APP_URL ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: "RepairLog — Equipment fault reporting for cafés",
    template: "%s · RepairLog",
  },
  description:
    "Report café equipment faults, coordinate repairs, and preserve service history.",
  applicationName: "RepairLog",
  openGraph: {
    type: "website",
    siteName: "RepairLog",
    title: "RepairLog — Equipment fault tracking for cafés",
    description:
      "Report broken café equipment from a QR code and track every repair to a verified fix.",
    images: [{ url: SOCIAL_IMAGE, width: 1200, height: 630, alt: "RepairLog" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RepairLog — Equipment fault tracking for cafés",
    description:
      "Report broken café equipment from a QR code and track every repair to a verified fix.",
    images: [SOCIAL_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#f8f5f0",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
