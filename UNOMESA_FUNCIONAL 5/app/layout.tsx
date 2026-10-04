import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile.css";
import "./floor-touch.css";
import "./floor-touch-refined.css";
import "./app-access.css";
import "./app-context.css";
import "./app-polish.css";
import { PUBLIC_SEO_COPY, publicSiteOrigin, searchIndexingEnabled } from "@/lib/public-seo";
const publicOrigin = publicSiteOrigin();
const publicCopy = PUBLIC_SEO_COPY.en;
import { ThemeToggle } from "@/components/theme-toggle";
import { AppPreferencesProvider } from "@/components/app-preferences";
export const viewport: Viewport = {width:"device-width",initialScale:1,viewportFit:"cover"};

export const metadata: Metadata = {
  title: publicCopy.title,
  description: publicCopy.description,
  ...(publicOrigin ? { metadataBase: new URL(publicOrigin) } : {}),
  robots: { index: searchIndexingEnabled(), follow: searchIndexingEnabled() },
  openGraph: { type: "website", siteName: "UnoMesa", title: publicCopy.title, description: publicCopy.description,
    ...(publicOrigin ? { images: [{ url: "/icon.png", width: 512, height: 512, alt: "UnoMesa" }] } : {}) },
  twitter: { card: "summary", title: publicCopy.title, description: publicCopy.description },
  icons: {
    icon: [
      { url: "/favicon.ico?v=unomesa-1", sizes: "any" },
      { url: "/icon.png?v=unomesa-1", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico?v=unomesa-1",
    apple: [{ url: "/apple-icon.png?v=unomesa-1", sizes: "180x180", type: "image/png" }],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppPreferencesProvider>
          {children}
          <ThemeToggle />
        </AppPreferencesProvider>
      </body>
    </html>
  );
}
