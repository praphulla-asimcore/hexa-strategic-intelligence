import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { IntelProvider } from "@/lib/store";
import { Shell } from "@/components/shell";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HEXA Strategic Intelligence",
  description: "Evidence-backed decision support: where Hexa can win profitable business next, against whom, at what price, and what to do.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}>
        <IntelProvider>
          <Shell>{children}</Shell>
        </IntelProvider>
      </body>
    </html>
  );
}
