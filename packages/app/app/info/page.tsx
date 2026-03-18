"use client";

import { NavBar } from "@/components/nav-bar";

const INFO_SECTIONS = [
  {
    title: "What is give.fun?",
    content:
      "A perpetual funding platform on Base. Create fundraisers for creators, public goods, agents, charities, or anything at all. Supporters fund with USDC and mine Karma Coins — like Bitcoin mining, but for things you care about.",
    bullets: [
      "50% of every contribution goes directly to the recipient",
      "Liquidity is locked forever — LP is burned on launch",
      "All contracts are immutable — nobody can change the rules",
    ],
  },
  {
    title: "Mining",
    content:
      "Fund USDC into daily mining pools. Each day has a fixed number of coins to distribute. Your share of the pool determines your share of coins mined.",
    bullets: [
      "Each day has a fixed number of coins to distribute",
      "Fund more = mine more coins proportionally",
      "Claim your mined coins after each day ends",
      "Early days have the highest rewards — early supporters get the most",
    ],
  },
  {
    title: "Bitcoin-Style Rewards",
    content:
      "Coin rewards follow a Bitcoin-inspired halving schedule compressed from 4-year halvings to monthly halvings, with perpetual tail rewards.",
    bullets: [
      "~50% of total supply is mined in the first month",
      "Rewards halve every 30 days",
      "Tail rewards kick in after ~7 months — coins are mined forever",
      "~21M coins from halvings, then slow perpetual growth",
    ],
  },
  {
    title: "Funding Split",
    content:
      "Every contribution is split transparently on-chain. The majority goes directly to whoever is being funded.",
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
      "Treasury fees accumulate as USDC and are auctioned off to LP holders. This permanently deepens liquidity for the coin.",
    bullets: [
      "Dutch auction — price decays over time",
      "Buy when the price makes it profitable",
      "LP used in auctions gets burned — liquidity only grows",
    ],
  },
  {
    title: "For Launchers",
    content:
      "Launch a fundraiser in one click. Everything is configured at launch and locked forever — fully immutable.",
    bullets: [
      "Bitcoin-style coin rewards by default",
      "Earn 4% of all funding as the team fee",
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
        <div className="px-5 pb-4">
          <h1 className="text-2xl font-bold tracking-tight font-display">About</h1>
          <p className="text-[13px] text-muted-foreground mt-1">How give.fun works and why it matters</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-5">
          <div className="space-y-0">
            {INFO_SECTIONS.map((section, index) => (
              <div
                key={index}
                className={`py-6 ${index > 0 ? "border-t border-border" : ""}`}
              >
                <h2 className="text-[17px] font-semibold text-foreground mb-3 font-display">
                  {section.title}
                </h2>
                <p className="text-[15px] text-muted-foreground leading-relaxed mb-4">
                  {section.content}
                </p>
                <ul className="space-y-2">
                  {section.bullets.map((bullet, i) => (
                    <li
                      key={i}
                      className="text-[14px] text-muted-foreground flex items-start gap-3 leading-snug"
                    >
                      <span className="text-zinc-400 mt-1">•</span>
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
