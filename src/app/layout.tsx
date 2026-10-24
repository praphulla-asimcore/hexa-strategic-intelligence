import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { IntelProvider } from "@/lib/store";
import { Shell } from "@/components/shell";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hexa Strategic Intelligence",
  description: "Evidence-backed decision support: where Hexa can win profitable business next, against whom, at what price, and what to do.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <IntelProvider>
          <Shell>{children}</Shell>
        </IntelProvider>
      </body>
    </html>
  );
}
