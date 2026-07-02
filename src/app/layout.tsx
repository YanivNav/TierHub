import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TRPCProvider } from "@/lib/trpc/provider";
import { ThemeProvider } from "@/components/theme-provider";
import TopBar from "@/components/top-bar";
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
    default: "TierHub",
    template: "%s · TierHub",
  },
  description: "Create and share tier lists for anything",
  openGraph: {
    title: "TierHub",
    description: "Create and share tier lists for anything",
    type: "website",
    siteName: "TierHub",
  },
  twitter: {
    card: "summary_large_image",
    title: "TierHub",
    description: "Create and share tier lists for anything",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}
      >
        <ThemeProvider>
          <TRPCProvider>
            <TopBar />
            {children}
          </TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
