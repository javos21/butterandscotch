import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Butter & Scotch", template: "%s · Butter & Scotch" },
  description: "Made-to-order bakes from Butter & Scotch, Trinidad.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
