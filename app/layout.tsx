import type { Metadata, Viewport } from "next";
import { Nunito, Young_Serif } from "next/font/google";
import "./globals.css";

// Display serif for names and headlines; rounded sans for everything else (DESIGN.md §3).
const youngSerif = Young_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-young-serif",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Butter & Scotch", template: "%s · Butter & Scotch" },
  description: "Made-to-order bakes from Butter & Scotch, Trinidad. Order online, pay by bank transfer.",
  icons: { icon: "/brand/logo-red.png" },
};

export const viewport: Viewport = {
  themeColor: "#FEF8F1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${youngSerif.variable} ${nunito.variable}`}>
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
