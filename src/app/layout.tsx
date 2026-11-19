import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Courier_Prime, Special_Elite } from "next/font/google";
import "./globals.css";

// Typography (ADR 0015): early-1980s paperback and case file.
// Titles and headings: Bookman, from TeX Gyre Bonum (GUST Font License), shipped with the app.
const bookman = localFont({
  src: [
    { path: "../fonts/tex-gyre-bonum/texgyrebonum-regular.otf", weight: "400", style: "normal" },
    { path: "../fonts/tex-gyre-bonum/texgyrebonum-italic.otf", weight: "400", style: "italic" },
    { path: "../fonts/tex-gyre-bonum/texgyrebonum-bold.otf", weight: "700", style: "normal" },
    { path: "../fonts/tex-gyre-bonum/texgyrebonum-bolditalic.otf", weight: "700", style: "italic" },
  ],
  variable: "--font-bookman",
  display: "swap",
});
// Labels and buttons: a typewriter face, like an IBM Selectric.
const typewriter = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-typewriter", display: "swap" });
// Notes in the casebook: a worn typewriter face.
const typedNote = Special_Elite({ subsets: ["latin"], weight: "400", variable: "--font-typed-note", display: "swap" });

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
      className={`${bookman.variable} ${typewriter.variable} ${typedNote.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-950 text-stone-100">
        {children}
      </body>
    </html>
  );
}
