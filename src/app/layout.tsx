import { CartProvider } from "@/context/CartContext";
import Navbar from "@/components/navbar";
import AuthListener from "@/components/AuthListener";
import Footer from "@/components/Footer";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Tipografía de títulos: redondeada y con personalidad, va con la mascota.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.officegama.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Office GaMa | Papelería importada en México",
    template: "%s | Office GaMa",
  },
  description:
    "Papelería importada con diseños únicos: libretas, plumas, stickers, washi tapes y más. Envíos a todo México.",
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "Office GaMa",
    title: "Office GaMa | Papelería importada en México",
    description:
      "Papelería importada con diseños únicos. Envíos a todo México.",
    images: [{ url: "/logo2.png", width: 640, height: 341 }],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#d6a8ff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-MX">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} bg-soft text-ink min-h-screen flex flex-col antialiased`}
      >
        <CartProvider>
          <a
            href="#contenido"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded-full focus:shadow-lg"
          >
            Saltar al contenido
          </a>

          <AuthListener />

          <Navbar />

          <main id="contenido" className="flex-1 w-full">
            <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 py-6 sm:py-10">
              {children}
            </div>
          </main>

          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
