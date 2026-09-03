import type { Metadata } from "next";
import { Montserrat, Caveat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-montserrat",
});
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: "Orca Mídias — Fotos de Eventos",
  description: "Encontre e compre suas fotos de eventos por reconhecimento facial.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${montserrat.variable} ${caveat.variable} min-h-screen flex flex-col font-montserrat antialiased text-orca-preto-marca`}
      >
        {children}
      </body>
    </html>
  );
}
