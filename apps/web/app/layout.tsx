import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/design-system/theme-provider";
import { RegisterSW } from "@/components/pwa/register-sw";
import { Providers } from "./providers";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CoachIn",
  description: "Consistency, gamified — plan your week, log workouts, level up.",
  applicationName: "CoachIn",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CoachIn",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e11" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body
        className={`${instrumentSans.variable} ${spaceGrotesk.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute='class'
          defaultTheme='dark'
          enableSystem
          disableTransitionOnChange>
          <Providers>{children}</Providers>
          <Sonner />
          <RegisterSW />
        </ThemeProvider>
      </body>
    </html>
  );
}
