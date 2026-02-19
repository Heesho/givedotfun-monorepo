import type { Metadata } from "next";
import { getRig } from "@/lib/subgraph-launchpad";
import RigDetailPage from "./client-page";

const appDomain = process.env.NEXT_PUBLIC_APP_URL || "https://give.fun";
const heroImageUrl = `${appDomain}/media/hero.png`;
const splashImageUrl = `${appDomain}/media/splash.png`;

type Props = {
  params: Promise<{ address: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const rigAddress = address.toLowerCase();

  // Fetch rig info from subgraph
  const rig = await getRig(rigAddress);

  const tokenName = rig?.unit?.name || "Fundraiser";
  const tokenSymbol = rig?.unit?.symbol || "TOKEN";
  const rigUrl = `${appDomain}/fundraiser/${rigAddress}`;

  // Mini app embed with rig-specific URL
  const miniAppEmbed = {
    version: "1",
    imageUrl: heroImageUrl,
    button: {
      title: `$${tokenSymbol} on give.fun`,
      action: {
        type: "launch_miniapp" as const,
        name: "give.fun",
        url: rigUrl,
        splashImageUrl,
        splashBackgroundColor: "#000000",
      },
    },
  };

  return {
    title: `${tokenName} ($${tokenSymbol}) | give.fun`,
    description: `${tokenName} ($${tokenSymbol}) on give.fun. Start donating and earning tokens now!`,
    openGraph: {
      title: `${tokenName} ($${tokenSymbol}) | give.fun`,
      description: `${tokenName} ($${tokenSymbol}) on give.fun. Start donating and earning tokens now!`,
      url: rigUrl,
      images: [
        {
          url: heroImageUrl,
        },
      ],
    },
    other: {
      "fc:miniapp": JSON.stringify(miniAppEmbed),
    },
  };
}

export default function Page() {
  return <RigDetailPage />;
}
