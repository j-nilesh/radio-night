import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

// Display font for headings — evocative, period-appropriate weight
const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

// Clean sans-serif for body, UI, and captions
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const DESCRIPTION =
  "A voice-first interactive detective game. Listen, question the suspects, follow the evidence, solve the case.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "Radio Night — An Interactive Radio Mystery", template: "%s" },
  description: DESCRIPTION,
  applicationName: "Radio Night",
  openGraph: {
    type: "website",
    siteName: "Radio Night",
    title: "Radio Night — An Interactive Radio Mystery",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: "Radio Night", description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#1c1917" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-950 text-stone-100">
        {children}
      </body>
    </html>
  );
}
