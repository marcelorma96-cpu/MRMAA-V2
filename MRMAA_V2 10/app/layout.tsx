import type { Metadata } from "next";
import "./globals.css";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "MRMAA",
  description: "Gestión de clientes, reservas y cotizaciones para restaurantes",
  icons: {
    icon: [
      { url: "/favicon.ico?v=5", sizes: "any" },
      { url: "/icon.png?v=5", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico?v=5",
    apple: [{ url: "/apple-icon.png?v=5", sizes: "180x180", type: "image/png" }],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
