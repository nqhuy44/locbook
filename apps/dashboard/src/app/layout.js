import Providers from "@/components/Providers";
import "./globals.css";

export const viewport = {
  themeColor: "#FFF0F5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata = {
  title: "Spotary — Vibe Collection",
  description: "Collect and organize places by vibe. Discover cafes, bars, and restaurants curated by taste.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Spotary",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Spotary — Vibe Collection",
    description: "Collect and organize places by vibe.",
    siteName: "Spotary",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
