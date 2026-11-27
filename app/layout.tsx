import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NostrProvider } from "@/context/NostrContext";
import { PricingProvider } from "./contexts/PricingContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

export const metadata: Metadata = {
  metadataBase: new URL("https://routstr.com"),
  title: {
    default: "Routstr",
    template: "%s | Routstr",
  },
  description:
    "Ask any AI model and pay per request in bitcoin. Independent nodes sell the models and your app picks the best price. No account, no card, no subscription.",
  keywords: [
    "AI",
    "Decentralized AI",
    "LLM",
    "Bitcoin",
    "Lightning Network",
    "Inference",
    "API",
    "Cashu",
    "Nostr",
  ],
  authors: [{ name: "Routstr Team" }],
  creator: "Routstr",
  publisher: "Routstr",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://routstr.com",
    title: "Routstr: AI is now permissionless, decentralized, private",
    description:
      "Ask any AI model and pay per request in bitcoin. No account, no card, no subscription.",
    siteName: "Routstr",
  },
  twitter: {
    card: "summary_large_image",
    title: "Routstr: AI is now permissionless, decentralized, private",
    description:
      "Ask any AI model and pay per request in bitcoin. No account, no card, no subscription.",
    creator: "@routstr",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className="antialiased min-h-screen bg-background text-muted-foreground selection:bg-foreground/20 selection:text-foreground"
      >
        <ThemeProvider>
          <NostrProvider>
            <PricingProvider>{children}</PricingProvider>
          </NostrProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
