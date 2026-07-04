import type { Metadata } from "next";
import { Instrument_Sans, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/design-system/theme-provider";

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
          {children}
          <Sonner />
        </ThemeProvider>
      </body>
    </html>
  );
}
