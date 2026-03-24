import "@/app/globals.css";
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";

const appDomain = process.env.NEXT_PUBLIC_APP_URL || "https://givedotfun.vercel.app";
const heroImageUrl = `${appDomain}/media/hero.png`;
const splashImageUrl = `${appDomain}/media/splash.png`;

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const miniAppEmbed = {
  version: "1",
  imageUrl: heroImageUrl,
  button: {
    title: "Start funding",
    action: {
      type: "launch_miniapp" as const,
      name: "give.fun",
      url: appDomain,
      splashImageUrl,
      splashBackgroundColor: "#000000",
    },
  },
};

export const metadata: Metadata = {
  title: "give.fun",
  description: "A crypto GoFundMe on Base. Create fundraisers, fund with USDC, mine coins.",
  openGraph: {
    title: "give.fun",
    description: "A crypto GoFundMe on Base. Create fundraisers, fund with USDC, mine coins.",
    url: appDomain,
    images: [
      {
        url: heroImageUrl,
      },
    ],
  },
  other: {
    "fc:miniapp": JSON.stringify(miniAppEmbed),
    "base:app_id": "694db1f1c63ad876c9081363",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
