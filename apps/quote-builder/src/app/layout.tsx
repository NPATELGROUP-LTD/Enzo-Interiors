import type { Metadata } from "next";
import { Archivo, Inter, Space_Grotesk } from "next/font/google";
import "@/styles/theme.css";
import { Toaster } from "@/components/ui/sonner";

// Same three faces as the website: Archivo for headings, Inter for the
// interface, Space Grotesk for dimensions and figures.
const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-archivo", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-space-grotesk", display: "swap" });

export const metadata: Metadata = {
  title: {
    template: "%s | Enzo Interiors",
    default: "Price your room | Enzo Interiors",
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        {/* The website's sand frame, so the prototype reads as part of the site. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] hidden border-[14px] border-enzo-sand md:block" />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
