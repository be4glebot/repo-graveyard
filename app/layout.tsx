import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/scene/ThemeProvider";
import { buildRootMetadata, resolveSiteUrl } from "@/lib/site-meta";
import { sceneFontVariables } from "./fonts";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = buildRootMetadata(
  resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
);

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sceneFontVariables} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
