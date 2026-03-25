"use client";

import Link from "next/link";
import { Particles } from "@/components/ui/particles";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background">
      <Particles className="!fixed inset-0 -z-10 bg-transparent" quantity={60} size={0.6} />
      <div className="flex flex-col items-center gap-10 px-6 text-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <img
            src="/media/icon.png"
            alt="give.fun"
            className="ghost-border h-20 w-20 bg-surface-lowest object-cover lg:h-24 lg:w-24"
          />
          <div className="font-display text-[2rem] font-semibold tracking-[-0.04em] text-primary lg:text-[2.5rem]">
            give.fun
          </div>
        </div>

        {/* Punchy one-liners */}
        <div className="flex flex-col gap-3">
          <div className="font-display text-[14px] font-semibold uppercase tracking-[0.18em] text-foreground lg:text-[16px]">
            Fund something.
          </div>
          <div className="font-display text-[14px] font-semibold uppercase tracking-[0.18em] text-foreground lg:text-[16px]">
            Mine its coin.
          </div>
          <div className="font-display text-[14px] font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:text-[16px]">
            Capital as signal.
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/explore"
          className="slab-button px-8 py-3 text-[12px]"
        >
          Enter App
        </Link>
      </div>
    </main>
  );
}
