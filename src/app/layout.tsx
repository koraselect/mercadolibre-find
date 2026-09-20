import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/layout/header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MercadoLibre Opportunity Finder",
    template: "%s · ML Opportunity Finder",
  },
  description:
    "Encuentra productos equivalentes de MercadoLibre Venezuela a menor precio y evalúa oportunidades de arbitraje.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <Header />
        <main className="flex-1 w-full">{children}</main>
        <footer className="border-t py-4 text-center text-xs text-muted-foreground">
          Herramienta de investigación de oportunidades. Verifica siempre precio,
          stock y condiciones del vendedor antes de actuar.
        </footer>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}