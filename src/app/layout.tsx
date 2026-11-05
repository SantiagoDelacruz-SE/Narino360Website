import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Observatorio de Paz, Seguridad y Convivencia • Nariño 360",
  description:
    "Observatorio de Paz, Seguridad y Convivencia de la Subsecretaría de Seguridad Ciudadana de la Gobernación de Nariño.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
