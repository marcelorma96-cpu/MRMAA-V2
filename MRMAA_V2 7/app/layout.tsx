import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MRMAA",
  description: "Gestión de clientes, reservas y cotizaciones para restaurantes",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
