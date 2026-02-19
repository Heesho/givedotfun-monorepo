"use client";

import { NavBar } from "@/components/nav-bar";

const INFO_SECTIONS = [
  {
    title: "What is give.fun?",
    content:
      "A fair-launch fundraising platform on Base. No presales, no insiders, no rugs. Tokens are earned through donations to creators and causes.",
    bullets: [
      "Liquidity is locked forever -- LP tokens are burned on launch",
      "All contracts are immutable -- nobody can change the rules",
      "Donate to causes and earn tokens proportional to your contribution",
    ],
  },
  {
    title: "How Donating Works",
    content:
      "Donate to a creator or cause and earn tokens in return. Each day's token emission is split among donors based on how much they contributed.",
    bullets: [
      "50% of every donation goes straight to the recipient",
      "Your share of that day's emission matches your share of donations",
      "Emissions halve on a schedule but never drop below a set floor",
    ],
  },
  {
    title: "Why It's Fair",
    content:
      "No hidden allocations. No team tokens. No presales. The token distribution is entirely determined by donations -- the more you give, the more you earn.",
    bullets: [
      "Everyone sees the same rules in real-time",
      "No hidden allocations or team tokens",
      "Treasury fees are auctioned off for LP tokens, which get burned -- permanently deepening liquidity",
    ],
  },
  {
    title: "For Launchers",
    content:
      "Launch a fundraiser with your own emission schedule and recipient. Everything is configured at launch and locked forever.",
    bullets: [
      "Set your own halvings, emission rates, and epoch durations",
      "Earn 4% of all activity on your fundraiser as the team fee",
      "Treasury accumulates fees that get auctioned to grow your liquidity",
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
                      <span className="text-zinc-500 mt-0.5">•</span>
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
