"use client";

import { useState } from "react";
import Link from "next/link";
import { Flame, ArrowRight, Check } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { useAuctions, type AuctionItem } from "@/hooks/useAuctions";
import { TokenLogo } from "@/components/token-logo";
import { formatPrice } from "@/lib/format";

function SkeletonRow() {
  return (
    <div className="slab-inset flex items-center justify-between px-3 py-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-secondary animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-16 bg-secondary animate-pulse" />
          <div className="h-3 w-24 bg-secondary animate-pulse" />
        </div>
      </div>
      <div className="space-y-2 text-right">
        <div className="ml-auto h-4 w-14 bg-secondary animate-pulse" />
        <div className="ml-auto h-3 w-10 bg-secondary animate-pulse" />
      </div>
    </div>
  );
}

function formatProfit(profit: number): string {
  const sign = profit >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(profit).toFixed(2)}`;
}

export default function AuctionsPage() {
  const { auctions, isLoading } = useAuctions();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedAuction: AuctionItem | undefined = auctions[selectedIndex];

  return (
    <main className="app-shell">
      <div
        className="app-frame"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 180px)",
        }}
      >
        {/* Header */}
        <div className="page-header">
          <div className="section-kicker">Treasury Mechanism</div>
          <h1 className="page-title mt-2">Auctions</h1>
          <p className="page-subtitle">
            Trade LP tokens for USDC rewards
          </p>
        </div>

        {/* Auction List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-1">
          <div className="space-y-2">
            {isLoading && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}

            {!isLoading &&
              auctions.map((auction, index) => (
                <button
                  key={auction.fundraiserAddress}
                  onClick={() => setSelectedIndex(index)}
                  className={`w-full px-3 py-4 text-left transition-all ${
                    selectedIndex === index
                      ? "data-row light-leak"
                      : index % 2 === 0
                        ? "data-row"
                        : "data-row data-row-alt"
                  } hover-slab`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <TokenLogo
                          name={auction.tokenName}
                          logoUrl={auction.logoUrl}
                          size="md-lg"
                        />
                        {selectedIndex === index && (
                          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center bg-primary text-primary-foreground shadow-slab">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-display text-[15px] font-semibold uppercase tracking-[-0.02em]">
                          {auction.tokenSymbol.length > 8
                            ? `${auction.tokenSymbol.slice(0, 8)}...`
                            : auction.tokenSymbol}
                        </div>
                        <div className="text-[13px] text-muted-foreground">
                          {auction.tokenName}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[15px] font-medium tabular-nums ${auction.isProfitable ? "positive-value" : "negative-value"}`}>
                        {formatProfit(auction.profit)}
                      </div>
                      <div className="text-[13px] text-muted-foreground">profit</div>
                    </div>
                  </div>
                </button>
              ))}

            {!isLoading && auctions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="slab-inset mb-3 flex h-12 w-12 items-center justify-center">
                  <Flame className="h-6 w-6 opacity-50" />
                </div>
                <p className="text-[15px] font-medium">No active auctions</p>
                <p className="text-[13px] mt-1 opacity-70">Check back later</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Bar */}
        {selectedAuction && (
          <div
            className="fixed left-0 right-0"
            style={{
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)",
            }}
          >
            <div className="glass-panel mx-auto max-w-[520px] px-4 py-4">
              {/* Trade Summary */}
              <div className="slab-inset mb-4 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="mb-1 text-[12px] text-muted-foreground">
                      You Pay
                    </div>
                    <div className="flex items-center gap-2">
                      <TokenLogo
                        name={selectedAuction.tokenName}
                        logoUrl={selectedAuction.logoUrl}
                        size="md-lg"
                      />
                      <div>
                        <span className="font-semibold text-[17px] tabular-nums">
                          {formatPrice(selectedAuction.lpCostUsd)}
                        </span>
                        <div className="text-[11px] text-muted-foreground">
                          {selectedAuction.tokenSymbol}-USDC LP
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="ghost-border flex h-8 w-8 items-center justify-center bg-surface-lowest">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] text-muted-foreground mb-1">
                      You Receive
                    </div>
                    <div className="font-semibold text-[17px] tabular-nums">
                      ${selectedAuction.rewardUsd.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">USDC</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className={`text-[15px] font-medium tabular-nums ${selectedAuction.isProfitable ? "positive-value" : "negative-value"}`}>
                  {selectedAuction.isProfitable
                    ? `+$${selectedAuction.profit.toFixed(2)} profit`
                    : `-$${Math.abs(selectedAuction.profit).toFixed(2)} loss`}
                </div>
                <Link
                  href={`/fundraiser/${selectedAuction.fundraiserAddress}`}
                  className="slab-button px-6 text-[11px]"
                >
                  Buy Auction
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
      <NavBar />
    </main>
  );
}
