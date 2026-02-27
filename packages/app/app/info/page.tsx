"use client";

import { NavBar } from "@/components/nav-bar";

const INFO_SECTIONS = [
  {
    title: "What is give.fun?",
    content:
      "A perpetual funding platform on Base. Create fundraisers for creators, public goods, agents, charities, or anything at all. Donors fund with USDC and mine proportional token emissions — like Bitcoin mining, but for things you care about.",
    bullets: [
      "50% of every donation goes directly to the recipient",
      "Liquidity is locked forever — LP tokens are burned on launch",
      "All contracts are immutable — nobody can change the rules",
    ],
  },
  {
    title: "Mining",
    content:
      "Fund USDC into daily mining pools. Each day has a fixed token emission. Your share of the pool determines your share of tokens mined.",
    bullets: [
      "Each epoch (1 day) has a fixed token emission to distribute",
      "Fund more = mine more tokens proportionally",
      "Claim your mined tokens after each epoch ends",
      "Early epochs have the highest emissions — early miners get the most",
    ],
  },
  {
    title: "Bitcoin-Style Emissions",
    content:
      "Token emissions follow a Bitcoin-inspired halving schedule compressed from 4-year halvings to monthly halvings, with perpetual tail emissions.",
    bullets: [
      "~50% of total supply is mined in the first month",
      "Emissions halve every 30 days",
      "Tail emissions kick in after ~7 months — tokens are mined forever",
      "~21M tokens from halvings, then slow perpetual inflation",
    ],
  },
  {
    title: "Funding Split",
    content:
      "Every donation is split transparently on-chain. The majority goes directly to whoever is being funded.",
    bullets: [
      "50% — Recipient (the person or cause being funded)",
      "45% — Treasury (grows liquidity via auctions)",
      "4% — Team (the launcher who created the fundraiser)",
      "1% — Protocol fee",
      "If no recipient is set, their 50% goes to the treasury instead",
    ],
  },
  {
    title: "Treasury Auctions",
    content:
      "Treasury fees accumulate as USDC and are auctioned off to LP token holders. This permanently deepens liquidity for the token.",
    bullets: [
      "Dutch auction — price decays over time",
      "Buy when the price makes it profitable",
      "LP tokens used in auctions get burned — liquidity only grows",
    ],
  },
  {
    title: "For Launchers",
    content:
      "Launch a fundraiser in one click. Everything is configured at launch and locked forever — fully immutable.",
    bullets: [
      "Bitcoin-style emission schedule by default",
      "Earn 4% of all donations as the team fee",
      "Treasury grows liquidity automatically via auctions",
      "Set a recipient — 50% of all funding goes directly to them",
    ],
  },
];

export default function InfoPage() {
  return (
    <main className="flex h-screen w-screen justify-center bg-zinc-800">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        {/* Header */}
        <div className="px-4 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">About</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4">
          <div className="space-y-6">
            {INFO_SECTIONS.map((section, index) => (
              <div
                key={index}
                className=""
              >
                <h2 className="font-semibold text-foreground mb-2">
                  {section.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-3">
                  {section.content}
                </p>
                <ul className="space-y-1.5">
                  {section.bullets.map((bullet, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <span className="text-zinc-500 mt-0.5">&bull;</span>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
      <NavBar />
    </main>
  );
}
