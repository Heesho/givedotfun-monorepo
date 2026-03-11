import "@/app/globals.css";
import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Inter, Archivo, IBM_Plex_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-display", weight: ["400", "500", "600", "700"] });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "600"] });

const appDomain = process.env.NEXT_PUBLIC_APP_URL || "https://give.fun";
const heroImageUrl = `${appDomain}/media/hero.png`;
const splashImageUrl = `${appDomain}/media/splash.png`;

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
    <html lang="en" className={`${inter.variable} ${archivo.variable} ${ibmPlexMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
