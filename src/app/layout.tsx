import { CartProvider } from "@/context/CartContext";
import Navbar from "@/components/navbar";
import AuthListener from "@/components/AuthListener";
import Footer from "@/components/Footer";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
    default: "Office GaMa",
    template: "%s | Office GaMa",
  },
  description: "Tienda online de papelería importada en México",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        className={`
          ${geistSans.variable}
          ${geistMono.variable}
          bg-[#faf9ff]
          text-neutral-900
          min-h-screen
          flex
          flex-col
          antialiased
        `}
      >
        <CartProvider>

          <AuthListener />

          <Navbar />

          {/* CONTENIDO GLOBAL */}
          <main className="flex-1 w-full">
            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-10">
              {children}
            </div>
          </main>

          <Footer />

        </CartProvider>
      </body>
    </html>
  );
}