import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MRMAA v2",
  description: "Gestión de clientes, reservas y cotizaciones para restaurantes",
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
