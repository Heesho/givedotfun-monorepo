"use client";

import { NavBar } from "@/components/nav-bar";

const INFO_SECTIONS = [
  {
    title: "What is give.fun?",
    content:
      "A crypto GoFundMe on Base. Create perpetual fundraisers for creators, charities, projects, or causes. Donors contribute USDC and earn proportional token emissions in return.",
    bullets: [
      "Liquidity is locked forever — LP tokens are burned on launch",
      "All contracts are immutable — nobody can change the rules",
      "50% of every donation goes directly to the recipient",
    ],
  },
  {
    title: "How It Works",
    content:
      "Donate USDC into daily epoch pools. Your share of that epoch's token emission matches your share of total donations. Emissions halve on a schedule but never drop below a set floor.",
    bullets: [
      "Each epoch (day) has a fixed token emission to distribute",
      "Your proportional share of donations = your share of tokens",
      "Claim your earned tokens after each epoch ends",
      "Emissions halve over time, creating decreasing supply inflation",
    ],
  },
  {
    title: "Fee Structure",
    content:
      "Every donation is split transparently. The majority goes directly to the designated recipient.",
    bullets: [
      "50% — Recipient (the person or cause being funded)",
      "45% — Treasury (grows liquidity via auctions)",
      "4% — Team (the launcher who created the fundraiser)",
      "1% — Protocol fee",
    ],
  },
  {
    title: "Treasury Auctions",
    content:
      "Treasury fees accumulate as USDC and are auctioned off to LP token holders. This permanently deepens liquidity for the token.",
    bullets: [
      "Auction price decays over time (Dutch auction)",
      "Buy when the price makes it profitable",
      "LP tokens used in auctions get burned — liquidity only grows",
    ],
  },
  {
    title: "For Launchers",
    content:
      "Launch a fundraiser with your own emission schedule and halving parameters. Everything is configured at launch and locked forever.",
    bullets: [
      "Set initial and floor emission rates",
      "Configure halving period and epoch duration",
      "Earn 4% of all donations as the team fee",
      "Treasury accumulates fees that get auctioned to grow liquidity",
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
