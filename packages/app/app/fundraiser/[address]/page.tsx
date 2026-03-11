import type { Metadata } from "next";
import { getFundraiser } from "@/lib/subgraph-launchpad";
import FundraiserDetailPage from "./client-page";

const appDomain = process.env.NEXT_PUBLIC_APP_URL || "https://give.fun";
const heroImageUrl = `${appDomain}/media/hero.png`;
const splashImageUrl = `${appDomain}/media/splash.png`;

type Props = {
  params: Promise<{ address: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const fundraiserAddress = address.toLowerCase();

  // Fetch fundraiser info from subgraph
  const fundraiser = await getFundraiser(fundraiserAddress);

  const tokenName = fundraiser?.coin?.name || "Fundraiser";
  const tokenSymbol = fundraiser?.coin?.symbol || "TOKEN";
  const fundraiserUrl = `${appDomain}/fundraiser/${fundraiserAddress}`;

  // Mini app embed with fundraiser-specific URL
  const miniAppEmbed = {
    version: "1",
    imageUrl: heroImageUrl,
    button: {
      title: `$${tokenSymbol} on give.fun`,
      action: {
        type: "launch_miniapp" as const,
        name: "give.fun",
        url: fundraiserUrl,
        splashImageUrl,
        splashBackgroundColor: "#000000",
      },
    },
  };

  return {
    title: `${tokenName} ($${tokenSymbol}) | give.fun`,
    description: `${tokenName} ($${tokenSymbol}) on give.fun. Start funding!`,
    openGraph: {
      title: `${tokenName} ($${tokenSymbol}) | give.fun`,
      description: `${tokenName} ($${tokenSymbol}) on give.fun. Start funding!`,
      url: fundraiserUrl,
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
  return <FundraiserDetailPage />;
}
